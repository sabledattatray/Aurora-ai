import {
  type Capabilities,
  type ChatRequest,
  type ModelInfo,
  type PrivacyMode,
  type Provider,
  type ProviderStatus,
  type Route,
  type StreamEvent,
} from '@aurora/core';
import { sendNetworkRequest, GatewayPrivacyError } from '../net/gateway';
import { parseNDJSONStream } from './ndjson';

export interface OllamaProviderOptions {
  endpoint?: string;
  privacyMode?: PrivacyMode;
}

export interface OllamaModelTag {
  name: string;
  model?: string;
  size?: number;
  digest?: string;
  modified_at?: string;
}

export class OllamaProvider implements Provider {
  readonly id = 'ollama';
  readonly name = 'Ollama (Local)';
  readonly route: Route = 'device-local';

  private endpoint: string;
  private privacyMode: PrivacyMode;

  constructor(options?: OllamaProviderOptions) {
    this.endpoint = (options?.endpoint ?? 'http://127.0.0.1:11434').replace(/\/+$/, '');
    this.privacyMode = options?.privacyMode ?? 'local-only';
  }

  setEndpoint(url: string) {
    this.endpoint = url.replace(/\/+$/, '');
  }

  setPrivacyMode(mode: PrivacyMode) {
    this.privacyMode = mode;
  }

  async getStatus(): Promise<ProviderStatus> {
    try {
      const res = await sendNetworkRequest({
        route: 'device-local',
        privacyMode: this.privacyMode,
        url: `${this.endpoint}/api/tags`,
        options: {
          method: 'GET',
          timeoutMs: 4000,
        },
      });

      if (!res.ok) {
        return {
          state: 'unavailable',
          reasonCode: 'PROVIDER_UNAVAILABLE',
          message: `Local server returned status ${res.status}`,
        };
      }

      return { state: 'reachable' };
    } catch (err: unknown) {
      if (err instanceof GatewayPrivacyError) {
        return {
          state: 'unavailable',
          reasonCode: 'LOCAL_ENDPOINT_BLOCKED',
          message: err.message,
        };
      }
      if (err instanceof Error) {
        if (err.message === 'REQUEST_TIMEOUT') {
          return {
            state: 'unavailable',
            reasonCode: 'REQUEST_TIMEOUT',
            message: 'Timed out trying to reach local Ollama endpoint.',
          };
        }
        // Browser network failure (e.g. CORS or Ollama not running)
        return {
          state: 'unavailable',
          reasonCode: 'PROVIDER_UNAVAILABLE',
          message: 'Could not reach local Ollama instance.',
        };
      }
      return {
        state: 'unavailable',
        reasonCode: 'UNKNOWN_SAFE_ERROR',
        message: 'An unknown error occurred checking local model status.',
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await sendNetworkRequest({
      route: 'device-local',
      privacyMode: this.privacyMode,
      url: `${this.endpoint}/api/tags`,
      options: {
        method: 'GET',
        timeoutMs: 5000,
      },
    });

    if (!res.ok) {
      throw new Error(`Failed to list models from Ollama: HTTP ${res.status}`);
    }

    const data = (await res.json()) as { models?: OllamaModelTag[] };
    const tags = data.models ?? [];

    return tags.map((t) => ({
      id: t.name,
      name: t.name,
      sizeBytes: t.size,
      modifiedAt: t.modified_at ? new Date(t.modified_at).getTime() : undefined,
    }));
  }

  async getCapabilities(modelId: string): Promise<Capabilities> {
    try {
      const res = await sendNetworkRequest({
        route: 'device-local',
        privacyMode: this.privacyMode,
        url: `${this.endpoint}/api/show`,
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: modelId }),
          timeoutMs: 5000,
        },
      });

      if (res.ok) {
        const info = (await res.json()) as {
          model_info?: Record<string, unknown>;
          parameters?: string;
        };
        // Check for context length in model info
        let ctx = 4096;
        if (info.model_info) {
          for (const key of Object.keys(info.model_info)) {
            if (key.includes('context_length') && typeof info.model_info[key] === 'number') {
              ctx = info.model_info[key] as number;
              break;
            }
          }
        }
        return {
          streaming: true,
          maxContextTokens: ctx,
          vision: false,
        };
      }
    } catch {
      // Fallback to safe defaults if show fails
    }

    return {
      streaming: true,
      maxContextTokens: 4096,
      vision: false,
    };
  }

  async *generateStream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamEvent> {
    const numCtx = req.options?.numCtx ?? 4096;
    const body = {
      model: req.modelId,
      messages: req.messages,
      stream: true,
      options: {
        num_ctx: numCtx,
        temperature: req.options?.temperature ?? 0.7,
      },
    };

    let response: Response;
    try {
      response = await sendNetworkRequest({
        route: 'device-local',
        privacyMode: this.privacyMode,
        url: `${this.endpoint}/api/chat`,
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
          timeoutMs: 60_000,
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === 'CANCELLED') {
          yield { type: 'error', code: 'CANCELLED', message: 'Generation was cancelled.' };
          return;
        }
        if (err.message === 'REQUEST_TIMEOUT') {
          yield { type: 'error', code: 'REQUEST_TIMEOUT', message: 'Request to local model timed out.' };
          return;
        }
      }
      yield {
        type: 'error',
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Could not connect to local model. Ensure Ollama is running.',
      };
      return;
    }

    if (!response.ok) {
      if (response.status === 404) {
        yield {
          type: 'error',
          code: 'MODEL_NOT_FOUND',
          message: `The model "${req.modelId}" was not found in your Ollama installation.`,
        };
        return;
      }
      yield {
        type: 'error',
        code: 'PROVIDER_UNAVAILABLE',
        message: `Local model returned HTTP error ${response.status}`,
      };
      return;
    }

    if (!response.body) {
      yield {
        type: 'error',
        code: 'NETWORK_ERROR',
        message: 'No response body received from local model.',
      };
      return;
    }

    let completedNormally = false;

    try {
      for await (const chunk of parseNDJSONStream<{
        message?: { content?: string };
        done?: boolean;
        prompt_eval_count?: number;
        eval_count?: number;
      }>(response.body, signal)) {
        if (chunk.message?.content) {
          yield { type: 'delta', text: chunk.message.content };
        }

        if (chunk.done) {
          completedNormally = true;
          if (chunk.prompt_eval_count || chunk.eval_count) {
            yield {
              type: 'usage',
              inputTokens: chunk.prompt_eval_count,
              outputTokens: chunk.eval_count,
            };
          }
          yield { type: 'done' };
          break;
        }
      }

      if (!completedNormally) {
        yield {
          type: 'error',
          code: 'CANCELLED',
          message: 'Stream ended before completion.',
        };
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.message === 'CANCELLED')) {
        yield { type: 'error', code: 'CANCELLED', message: 'Stream stopped.' };
      } else {
        yield {
          type: 'error',
          code: 'NETWORK_ERROR',
          message: 'An error occurred during local streaming.',
        };
      }
    }
  }
}
