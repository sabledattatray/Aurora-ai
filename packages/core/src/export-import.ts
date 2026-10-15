import { LIMITS } from './limits';
import type { MessageStatus, Role, Route } from './types';

export const EXPORT_FORMAT = 'aurora-export';
export const CURRENT_EXPORT_VERSION = 1;

export interface ExportedMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  status: MessageStatus;
  providerId?: string;
  modelId?: string;
  route?: Route;
}

export interface ExportedConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ExportedMessage[];
}

export interface AuroraExportData {
  format: 'aurora-export';
  version: number;
  exportedAt: number;
  app: {
    name: string;
    version: string;
  };
  conversations: ExportedConversation[];
}

export interface ImportPreviewSummary {
  conversationsCount: number;
  messagesCount: number;
  oldestTimestamp?: number;
  newestTimestamp?: number;
}

export type ValidationResult =
  | { ok: true; data: AuroraExportData; summary: ImportPreviewSummary }
  | { ok: false; error: string };

/**
 * Validates untrusted import JSON strictly against the aurora-export schema (PRD 11.4, AC-07).
 */
export function validateImportData(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Import file must be a valid JSON object.' };
  }

  const obj = raw as Record<string, unknown>;

  if (obj['format'] !== EXPORT_FORMAT) {
    return { ok: false, error: `Invalid format: expected "${EXPORT_FORMAT}", received "${String(obj['format'])}".` };
  }

  if (typeof obj['version'] !== 'number') {
    return { ok: false, error: 'Missing export schema version number.' };
  }

  if (obj['version'] > CURRENT_EXPORT_VERSION) {
    return {
      ok: false,
      error: `This export file was created with a newer version of Aurora (v${obj['version']}). This version only supports v${CURRENT_EXPORT_VERSION}. Please update Aurora.`,
    };
  }

  if (obj['version'] < 1) {
    return { ok: false, error: 'Invalid schema version.' };
  }

  if (!Array.isArray(obj['conversations'])) {
    return { ok: false, error: 'Field "conversations" must be an array.' };
  }

  const rawConvs = obj['conversations'] as unknown[];
  if (rawConvs.length > LIMITS.maxImportConversations) {
    return {
      ok: false,
      error: `File contains ${rawConvs.length.toLocaleString()} conversations, which exceeds the limit of ${LIMITS.maxImportConversations.toLocaleString()}.`,
    };
  }

  let totalMessages = 0;
  let oldest: number | undefined;
  let newest: number | undefined;

  const validatedConvs: ExportedConversation[] = [];

  for (let i = 0; i < rawConvs.length; i++) {
    const c = rawConvs[i];
    if (!c || typeof c !== 'object') {
      return { ok: false, error: `Conversation at index ${i} is not a valid object.` };
    }
    const cObj = c as Record<string, unknown>;

    if (typeof cObj['id'] !== 'string' || !cObj['id']) {
      return { ok: false, error: `Conversation at index ${i} is missing a valid id.` };
    }
    if (typeof cObj['title'] !== 'string') {
      return { ok: false, error: `Conversation at index ${i} is missing a title.` };
    }
    if (typeof cObj['createdAt'] !== 'number' || typeof cObj['updatedAt'] !== 'number') {
      return { ok: false, error: `Conversation at index ${i} has invalid timestamps.` };
    }

    if (!Array.isArray(cObj['messages'])) {
      return { ok: false, error: `Conversation "${cObj['title']}" is missing a messages array.` };
    }

    const rawMsgs = cObj['messages'] as unknown[];
    const validatedMsgs: ExportedMessage[] = [];

    for (let j = 0; j < rawMsgs.length; j++) {
      totalMessages++;
      if (totalMessages > LIMITS.maxImportMessages) {
        return {
          ok: false,
          error: `Export exceeds maximum allowed message count of ${LIMITS.maxImportMessages.toLocaleString()}.`,
        };
      }

      const m = rawMsgs[j];
      if (!m || typeof m !== 'object') {
        return { ok: false, error: `Message ${j} in conversation "${cObj['title']}" is invalid.` };
      }
      const mObj = m as Record<string, unknown>;

      if (typeof mObj['id'] !== 'string' || !mObj['id']) {
        return { ok: false, error: `Message ${j} in conversation "${cObj['title']}" has invalid id.` };
      }
      if (typeof mObj['role'] !== 'string' || !['user', 'assistant', 'system'].includes(mObj['role'])) {
        return { ok: false, error: `Message ${j} has invalid role: ${String(mObj['role'])}.` };
      }
      if (typeof mObj['content'] !== 'string') {
        return { ok: false, error: `Message ${j} has invalid content.` };
      }
      if (typeof mObj['createdAt'] !== 'number') {
        return { ok: false, error: `Message ${j} has invalid timestamp.` };
      }

      const msgTime = mObj['createdAt'];
      if (oldest === undefined || msgTime < oldest) oldest = msgTime;
      if (newest === undefined || msgTime > newest) newest = msgTime;

      validatedMsgs.push({
        id: mObj['id'],
        role: mObj['role'] as Role,
        content: mObj['content'],
        createdAt: msgTime,
        status: (mObj['status'] as MessageStatus) || 'complete',
        providerId: typeof mObj['providerId'] === 'string' ? mObj['providerId'] : undefined,
        modelId: typeof mObj['modelId'] === 'string' ? mObj['modelId'] : undefined,
        route: mObj['route'] === 'cloud' || mObj['route'] === 'device-local' ? mObj['route'] : undefined,
      });
    }

    validatedConvs.push({
      id: cObj['id'],
      title: cObj['title'],
      createdAt: cObj['createdAt'],
      updatedAt: cObj['updatedAt'],
      messages: validatedMsgs,
    });
  }

  return {
    ok: true,
    data: {
      format: 'aurora-export',
      version: obj['version'],
      exportedAt: typeof obj['exportedAt'] === 'number' ? obj['exportedAt'] : Date.now(),
      app: {
        name: typeof (obj['app'] as any)?.name === 'string' ? (obj['app'] as any).name : 'Aurora AI',
        version: typeof (obj['app'] as any)?.version === 'string' ? (obj['app'] as any).version : '1.0',
      },
      conversations: validatedConvs,
    },
    summary: {
      conversationsCount: validatedConvs.length,
      messagesCount: totalMessages,
      oldestTimestamp: oldest,
      newestTimestamp: newest,
    },
  };
}
