import {
  CURRENT_DISCLOSURE_VERSION,
  type Capabilities,
  type ChatRequest,
  type ConsentRecord,
  type ModelInfo,
  type PrivacyMode,
  type Provider,
  type ProviderStatus,
  type Route,
  type StreamEvent,
} from '@aurora/core';
import { sendNetworkRequest, GatewayPrivacyError } from '../net/gateway';

export interface HostedProviderOptions {
  gatewayUrl?: string;
  privacyMode?: PrivacyMode;
  consent?: ConsentRecord;
}

export class HostedWorkersAIProvider implements Provider {
  readonly id = 'workers-ai';
  readonly name = 'Cloudflare Workers AI';
  readonly route: Route = 'cloud';

  private gatewayUrl: string;
  private privacyMode: PrivacyMode;
  private consent?: ConsentRecord;

  constructor(options?: HostedProviderOptions) {
    this.gatewayUrl = (options?.gatewayUrl ?? '/api').replace(/\/+$/, '');
    this.privacyMode = options?.privacyMode ?? 'ask-before-cloud';
    this.consent = options?.consent;
  }

  setGatewayUrl(url: string) {
    this.gatewayUrl = url.replace(/\/+$/, '');
  }

  setPrivacyMode(mode: PrivacyMode) {
    this.privacyMode = mode;
  }

  setConsent(consent?: ConsentRecord) {
    this.consent = consent;
  }

  async getStatus(): Promise<ProviderStatus> {
    try {
      const res = await sendNetworkRequest({
        route: 'cloud',
        privacyMode: this.privacyMode,
        url: `${this.gatewayUrl}/health`,
        options: {
          method: 'GET',
          timeoutMs: 4000,
        },
        consent: this.consent,
      });

      if (!res.ok) {
        return {
          state: 'unavailable',
          reasonCode: 'PROVIDER_UNAVAILABLE',
          message: `Gateway returned status ${res.status}`,
        };
      }

      return { state: 'reachable' };
    } catch (err: unknown) {
      if (err instanceof GatewayPrivacyError) {
        return {
          state: 'unavailable',
          reasonCode: 'CONSENT_REQUIRED',
          message: err.message,
        };
      }
      return {
        state: 'unavailable',
        reasonCode: 'PROVIDER_UNAVAILABLE',
        message: 'Could not reach hosted gateway.',
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await sendNetworkRequest({
        route: 'cloud',
        privacyMode: this.privacyMode,
        url: `${this.gatewayUrl}/models`,
        options: {
          method: 'GET',
          timeoutMs: 4000,
        },
        consent: this.consent,
      });

      if (res.ok) {
        const data = (await res.json()) as { models?: string[] };
        const models = data.models ?? [];
        return models.map((m) => ({
          id: m,
          name: m,
        }));
      }
    } catch {
      // Fallback
    }

    return [
      { id: '@cf/meta/llama-3-8b-instruct', name: 'Llama 3 (8B Instruct - Cloud)' },
      { id: '@cf/meta/llama-3.1-8b-instruct', name: 'Llama 3.1 (8B Instruct - Cloud)' },
      { id: '@cf/mistral/mistral-7b-instruct-v0.2', name: 'Mistral 7B (Instruct - Cloud)' },
    ];
  }

  getCapabilities(_modelId: string): Capabilities {
    return {
      streaming: true,
      maxContextTokens: 4096,
      vision: false,
    };
  }

  async *generateStream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    let response: Response;
    try {
      response = await sendNetworkRequest({
        route: 'cloud',
        privacyMode: this.privacyMode,
        url: `${this.gatewayUrl}/chat`,
        consent: this.consent,
        options: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Aurora-Consent': CURRENT_DISCLOSURE_VERSION,
          },
          body: JSON.stringify({
            requestId: req.requestId,
            modelId: req.modelId,
            messages: req.messages,
            maxOutputTokens: req.maxOutputTokens,
            temperature: req.options?.temperature,
          }),
          signal,
          timeoutMs: 60_000,
        },
      });
    } catch (err: unknown) {
      if (err instanceof GatewayPrivacyError) {
        yield { type: 'error', code: 'CONSENT_REQUIRED', message: err.message };
        return;
      }
      if (err instanceof Error) {
        if (err.message === 'CANCELLED') {
          yield { type: 'error', code: 'CANCELLED', message: 'Generation was cancelled.' };
          return;
        }
        if (err.message === 'REQUEST_TIMEOUT') {
          yield { type: 'error', code: 'REQUEST_TIMEOUT', message: 'Cloud service timed out.' };
          return;
        }
      }
      yield {
        type: 'error',
        code: 'NETWORK_ERROR',
        message: 'Could not connect to online AI provider.',
      };
      return;
    }

    if (!response.ok) {
      try {
        const errJson = (await response.json()) as { error?: { code?: string; message?: string } };
        const code = (errJson.error?.code as any) || 'PROVIDER_UNAVAILABLE';
        yield {
          type: 'error',
          code,
          message: errJson.error?.message || `Gateway returned HTTP ${response.status}`,
        };
      } catch {
        yield {
          type: 'error',
          code: 'PROVIDER_UNAVAILABLE',
          message: `Gateway returned HTTP ${response.status}`,
        };
      }
      return;
    }

    if (!response.body) {
      yield { type: 'error', code: 'NETWORK_ERROR', message: 'No stream body returned by gateway.' };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const dataContent = trimmed.slice(5).trim();
          if (!dataContent) continue;

          try {
            const ev = JSON.parse(dataContent) as StreamEvent;
            yield ev;
            if (ev.type === 'done' || ev.type === 'error') {
              return;
            }
          } catch {
            // Ignore non-json lines
          }
        }
      }

      yield { type: 'done' };
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message === 'CANCELLED')) {
        yield { type: 'error', code: 'CANCELLED', message: 'Stream stopped.' };
      } else {
        yield { type: 'error', code: 'NETWORK_ERROR', message: 'Stream interrupted.' };
      }
    } finally {
      reader.releaseLock();
    }
  }
}
