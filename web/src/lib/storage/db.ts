import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ConsentRecord, Conversation, Message, Preferences } from '@aurora/core';

export const DB_VERSION = 2;
export const SCHEMA_VERSION = 2;

export interface AttachmentRecord {
  id: string;
  conversationId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
  parseStatus: 'pending' | 'parsed' | 'partial' | 'failed';
  pageCount?: number;
  processedPages?: number;
  extractedText?: string;
}

interface AuroraDB extends DBSchema {
  conversations: { key: string; value: Conversation; indexes: { updatedAt: number } };
  messages: { key: string; value: Message; indexes: { conversationId: [string, number] } };
  preferences: { key: string; value: Preferences & { id: 'prefs' } };
  consents: { key: string; value: ConsentRecord };
  attachments: { key: string; value: AttachmentRecord; indexes: { conversationId: string } };
  meta: { key: string; value: { key: string; value: unknown } };
}

export type AuroraConn = IDBPDatabase<AuroraDB>;

export type StorageErrorCode = 'STORAGE_UNAVAILABLE' | 'STORAGE_QUOTA_EXCEEDED';
export class StorageError extends Error {
  constructor(public code: StorageErrorCode) {
    super(code);
    this.name = 'StorageError';
  }
}

export function mapStorageError(e: unknown): StorageError {
  if (e instanceof StorageError) return e;
  const name = (e as { name?: string } | null)?.name;
  if (name === 'QuotaExceededError') return new StorageError('STORAGE_QUOTA_EXCEEDED');
  return new StorageError('STORAGE_UNAVAILABLE');
}

export async function openAuroraDb(name = 'aurora', onVersionChange?: () => void): Promise<AuroraConn> {
  try {
    if (typeof indexedDB === 'undefined') throw new StorageError('STORAGE_UNAVAILABLE');
    return await openDB<AuroraDB>(name, DB_VERSION, {
      upgrade(db, oldVersion) {
        // Migration steps: applied in order
        if (oldVersion < 1) {
          const conv = db.createObjectStore('conversations', { keyPath: 'id' });
          conv.createIndex('updatedAt', 'updatedAt');
          const msg = db.createObjectStore('messages', { keyPath: 'id' });
          msg.createIndex('conversationId', ['conversationId', 'createdAt']);
          db.createObjectStore('preferences', { keyPath: 'id' });
          db.createObjectStore('meta', { keyPath: 'key' });
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains('consents')) {
            db.createObjectStore('consents', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('attachments')) {
            const att = db.createObjectStore('attachments', { keyPath: 'id' });
            att.createIndex('conversationId', 'conversationId');
          }
        }
      },
      blocking() {
        onVersionChange?.();
      },
    });
  } catch (e) {
    throw mapStorageError(e);
  }
}
