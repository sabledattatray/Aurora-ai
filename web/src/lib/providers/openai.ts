import {
  isLoopbackEndpoint,
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

export interface OpenAICompatibleOptions {
  endpoint?: string;
  apiKey?: string;
  modelId?: string;
  privacyMode?: PrivacyMode;
  consent?: ConsentRecord;
}

export class OpenAICompatibleProvider implements Provider {
  readonly id = 'openai-compatible';
  readonly name = 'OpenAI-Compatible (Custom / LM Studio / Cloud)';

  private endpoint: string;
  private apiKey?: string;
  private modelId?: string;
  private privacyMode: PrivacyMode;
  private consent?: ConsentRecord;

  constructor(options?: OpenAICompatibleOptions) {
    this.endpoint = (options?.endpoint ?? 'http://127.0.0.1:1234/v1').replace(/\/+$/, '');
    this.apiKey = options?.apiKey;
    this.modelId = options?.modelId;
    this.privacyMode = options?.privacyMode ?? 'local-only';
    this.consent = options?.consent;
  }

  get route(): Route {
    return isLoopbackEndpoint(this.endpoint) ? 'device-local' : 'cloud';
  }

  setOptions(options: Partial<OpenAICompatibleOptions>) {
    if (options.endpoint !== undefined) this.endpoint = options.endpoint.replace(/\/+$/, '');
    if (options.apiKey !== undefined) this.apiKey = options.apiKey;
    if (options.modelId !== undefined) this.modelId = options.modelId;
    if (options.privacyMode !== undefined) this.privacyMode = options.privacyMode;
    if (options.consent !== undefined) this.consent = options.consent;
  }

  async getStatus(): Promise<ProviderStatus> {
    try {
      const res = await sendNetworkRequest({
        route: this.route,
        privacyMode: this.privacyMode,
        url: `${this.endpoint}/models`,
        options: {
          method: 'GET',
          headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
          timeoutMs: 4000,
        },
        consent: this.consent,
      });

      if (!res.ok) {
        return {
          state: 'unavailable',
          reasonCode: 'PROVIDER_UNAVAILABLE',
          message: `Endpoint returned HTTP status ${res.status}`,
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
        message: 'Could not reach endpoint.',
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await sendNetworkRequest({
        route: this.route,
        privacyMode: this.privacyMode,
        url: `${this.endpoint}/models`,
        options: {
          method: 'GET',
          headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
          timeoutMs: 4000,
        },
        consent: this.consent,
      });

      if (!res.ok) return [];
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      if (!Array.isArray(data.data)) return [];

      return data.data.map((m) => ({
        id: m.id,
        name: m.id,
        contextLength: 8192,
      }));
    } catch {
      return [];
    }
  }

  getCapabilities(_modelId: string): Capabilities {
    return {
      streaming: true,
      maxContextTokens: 8192,
      vision: false,
    };
  }

  async *generateStream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const payload = {
      model: req.modelId,
      messages: req.messages,
      stream: true,
      temperature: req.options?.temperature ?? 0.7,
      max_tokens: req.maxOutputTokens ?? 2048,
    };

    let res: Response;
    try {
      res = await sendNetworkRequest({
        route: this.route,
        privacyMode: this.privacyMode,
        url: `${this.endpoint}/chat/completions`,
        options: {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal,
        },
        consent: this.consent,
      });
    } catch (err: unknown) {
      if (err instanceof GatewayPrivacyError) {
        yield { type: 'error', code: 'CONSENT_REQUIRED', message: err.message };
        return;
      }
      if (signal?.aborted) {
        yield { type: 'error', code: 'CANCELLED', message: 'Request cancelled' };
        return;
      }
      yield { type: 'error', code: 'NETWORK_ERROR', message: 'Failed to connect to endpoint' };
      return;
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      yield {
        type: 'error',
        code: res.status === 429 ? 'RATE_LIMITED' : 'PROVIDER_UNAVAILABLE',
        message: `HTTP ${res.status}: ${errText.slice(0, 200)}`,
      };
      return;
    }

    if (!res.body) {
      yield { type: 'error', code: 'NETWORK_ERROR', message: 'No response body' };
      return;
    }

    const reader = res.body.getReader();
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
          const jsonStr = trimmed.slice(5).trim();
          if (jsonStr === '[DONE]') {
            yield { type: 'done' };
            return;
          }

          try {
            const parsed = JSON.parse(jsonStr) as {
              choices?: Array<{ delta?: { content?: string } }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number };
            };

            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yield { type: 'delta', text: delta };
            }

            if (parsed.usage) {
              yield {
                type: 'usage',
                inputTokens: parsed.usage.prompt_tokens,
                outputTokens: parsed.usage.completion_tokens,
              };
            }
          } catch {
            // Ignore malformed intermediate chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done' };
  }
}
