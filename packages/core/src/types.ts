import type { ErrorCode } from './errors';

export type Role = 'system' | 'user' | 'assistant';
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'interrupted' | 'failed';
export type Route = 'device-local' | 'cloud';
export type PrivacyMode = 'local-only' | 'ask-before-cloud';
export type Theme = 'light' | 'dark' | 'system';

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
  archived?: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  role: Role;
  content: string;
  createdAt: number;
  status: MessageStatus;
  providerId?: string;
  modelId?: string;
  route?: Route;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  attachmentIds?: string[];
  errorCode?: string;
}

export interface Preferences {
  theme: Theme;
  privacyMode: PrivacyMode;
  preferredProvider?: string;
  preferredModel?: string;
  localEndpoint?: string;
  customEndpoint?: string;
  apiKey?: string;
  contextWindowTokens?: number;
  settingsVersion: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  privacyMode: 'local-only',
  localEndpoint: 'http://127.0.0.1:11434',
  contextWindowTokens: 4096,
  settingsVersion: 1,
};

export type ProviderState = 'configured' | 'reachable' | 'unavailable' | 'unknown';

export interface ProviderStatus {
  state: ProviderState;
  reasonCode?: ErrorCode;
  message?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  sizeBytes?: number;
  contextLength?: number;
  modifiedAt?: number;
}

export interface Capabilities {
  streaming: boolean;
  maxContextTokens?: number;
  vision: boolean;
}

export interface ChatRequestMessage {
  role: Role;
  content: string;
}

export interface ChatRequest {
  requestId: string;
  messages: ChatRequestMessage[];
  modelId: string;
  route: Route;
  maxOutputTokens?: number;
  options?: {
    temperature?: number;
    numCtx?: number;
  };
  consent?: string;
}

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number }
  | { type: 'done' }
  | { type: 'error'; code: ErrorCode; message: string };

export interface Provider {
  readonly id: string;
  readonly name: string;
  readonly route: Route;
  getStatus(): Promise<ProviderStatus>;
  listModels?(): Promise<ModelInfo[]>;
  getCapabilities(modelId: string): Promise<Capabilities> | Capabilities;
  generateStream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<StreamEvent>;
}

export interface ConsentRecord {
  id: string;
  purpose: 'cloud-text' | 'cloud-attachments';
  scope: {
    conversationId?: string;
    providerId: string;
  };
  choice: 'granted' | 'denied';
  timestamp: number;
  disclosureVersion: string;
  revokedAt?: number;
}
