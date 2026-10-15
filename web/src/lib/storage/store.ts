import {
  DEFAULT_PREFERENCES,
  deriveTitle,
  type AuroraExportData,
  type ConsentRecord,
  type Conversation,
  type Message,
  type Preferences,
} from '@aurora/core';
import { mapStorageError, openAuroraDb, SCHEMA_VERSION, type AuroraConn } from './db';
import { APP_NAME, APP_VERSION } from '../config';

export interface AuroraStore {
  createConversation(title?: string): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | undefined>;
  listConversations(): Promise<Conversation[]>;
  renameConversation(id: string, title: string): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  searchConversations(query: string): Promise<Conversation[]>;
  addMessage(m: Omit<Message, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): Promise<Message>;
  updateMessage(id: string, patch: Partial<Omit<Message, 'id' | 'conversationId'>>): Promise<void>;
  listMessages(conversationId: string): Promise<Message[]>;
  getPreferences(): Promise<Preferences>;
  setPreferences(patch: Partial<Preferences>): Promise<Preferences>;
  saveConsent(consent: ConsentRecord): Promise<void>;
  listConsents(): Promise<ConsentRecord[]>;
  revokeConsent(id: string): Promise<void>;
  exportData(): Promise<AuroraExportData>;
  importData(data: AuroraExportData): Promise<{ importedConversations: number; importedMessages: number }>;
  clearAll(): Promise<void>;
  close(): void;
}

const uuid = () => crypto.randomUUID();

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw mapStorageError(e);
  }
}

export async function createStore(dbName = 'aurora', onVersionChange?: () => void): Promise<AuroraStore> {
  const db: AuroraConn = await openAuroraDb(dbName, () => {
    db.close();
    onVersionChange?.();
  });

  const touch = async (id: string, patch: Partial<Conversation> = {}) => {
    const c = await db.get('conversations', id);
    if (c) await db.put('conversations', { ...c, ...patch, updatedAt: Date.now() });
  };

  return {
    createConversation: (title) => guard(async () => {
      const now = Date.now();
      const c: Conversation = {
        id: uuid(), title: title?.trim() || 'New chat',
        createdAt: now, updatedAt: now, schemaVersion: SCHEMA_VERSION,
      };
      await db.put('conversations', c);
      return c;
    }),
    getConversation: (id) => guard(() => db.get('conversations', id)),
    listConversations: () => guard(async () => {
      const all = await db.getAll('conversations');
      return all.sort((a, b) => b.updatedAt - a.updatedAt);
    }),
    renameConversation: (id, title) => guard(async () => {
      const t = title.replace(/\s+/g, ' ').trim();
      if (!t) return;
      await touch(id, { title: t.slice(0, 120) });
    }),
    deleteConversation: (id) => guard(async () => {
      const tx = db.transaction(['conversations', 'messages'], 'readwrite');
      const msgs = await tx.objectStore('messages').index('conversationId')
        .getAll(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
      for (const m of msgs) await tx.objectStore('messages').delete(m.id);
      await tx.objectStore('conversations').delete(id);
      await tx.done;
    }),
    searchConversations: (query) => guard(async () => {
      const q = query.trim().toLowerCase();
      const all = (await db.getAll('conversations')).sort((a, b) => b.updatedAt - a.updatedAt);
      if (!q) return all;
      const hits: Conversation[] = [];
      for (const c of all) {
        if (c.title.toLowerCase().includes(q)) { hits.push(c); continue; }
        const msgs = await db.getAllFromIndex('messages', 'conversationId',
          IDBKeyRange.bound([c.id, 0], [c.id, Number.MAX_SAFE_INTEGER]));
        if (msgs.some((m) => m.content.toLowerCase().includes(q))) hits.push(c);
      }
      return hits;
    }),
    addMessage: (m) => guard(async () => {
      const msg: Message = { ...m, id: m.id ?? uuid(), createdAt: m.createdAt ?? Date.now() };
      await db.put('messages', msg);
      const conv = await db.get('conversations', m.conversationId);
      if (conv) {
        const patch: Partial<Conversation> = {};
        if (m.role === 'user' && conv.title === 'New chat') patch.title = deriveTitle(m.content);
        await touch(conv.id, patch);
      }
      return msg;
    }),
    updateMessage: (id, patch) => guard(async () => {
      const m = await db.get('messages', id);
      if (!m) return;
      await db.put('messages', { ...m, ...patch });
      await touch(m.conversationId);
    }),
    listMessages: (conversationId) => guard(() => db.getAllFromIndex('messages', 'conversationId',
      IDBKeyRange.bound([conversationId, 0], [conversationId, Number.MAX_SAFE_INTEGER]))),
    getPreferences: () => guard(async () => {
      const p = await db.get('preferences', 'prefs');
      if (!p) return { ...DEFAULT_PREFERENCES };
      const { id, ...rest } = p;
      void id;
      return { ...DEFAULT_PREFERENCES, ...rest };
    }),
    setPreferences: (patch) => guard(async () => {
      const cur = await db.get('preferences', 'prefs');
      const { id, ...rest } = cur ?? { id: 'prefs' as const };
      void id;
      const next: Preferences = { ...DEFAULT_PREFERENCES, ...rest, ...patch };
      await db.put('preferences', { ...next, id: 'prefs' });
      return next;
    }),
    saveConsent: (consent) => guard(async () => {
      await db.put('consents', consent);
    }),
    listConsents: () => guard(async () => {
      return await db.getAll('consents');
    }),
    revokeConsent: (id) => guard(async () => {
      const existing = await db.get('consents', id);
      if (existing) {
        await db.put('consents', { ...existing, revokedAt: Date.now() });
      }
    }),
    exportData: () => guard(async () => {
      const convs = await db.getAll('conversations');
      const sortedConvs = convs.sort((a, b) => b.updatedAt - a.updatedAt);
      const exportedConversations = await Promise.all(
        sortedConvs.map(async (c) => {
          const msgs = await db.getAllFromIndex(
            'messages',
            'conversationId',
            IDBKeyRange.bound([c.id, 0], [c.id, Number.MAX_SAFE_INTEGER])
          );
          return {
            id: c.id,
            title: c.title,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            messages: msgs.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
              status: m.status,
              providerId: m.providerId,
              modelId: m.modelId,
              route: m.route,
            })),
          };
        })
      );

      const exportObj: AuroraExportData = {
        format: 'aurora-export',
        version: 1,
        exportedAt: Date.now(),
        app: {
          name: APP_NAME,
          version: APP_VERSION,
        },
        conversations: exportedConversations,
      };

      return exportObj;
    }),
    importData: (data) => guard(async () => {
      const tx = db.transaction(['conversations', 'messages'], 'readwrite');
      let msgCount = 0;

      for (const conv of data.conversations) {
        const newConvId = uuid();
        const convRecord: Conversation = {
          id: newConvId,
          title: conv.title,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          schemaVersion: SCHEMA_VERSION,
        };
        await tx.objectStore('conversations').put(convRecord);

        for (const msg of conv.messages) {
          msgCount++;
          const newMsgId = uuid();
          const msgRecord: Message = {
            id: newMsgId,
            conversationId: newConvId,
            role: msg.role,
            content: msg.content,
            createdAt: msg.createdAt,
            status: msg.status,
            providerId: msg.providerId,
            modelId: msg.modelId,
            route: msg.route,
          };
          await tx.objectStore('messages').put(msgRecord);
        }
      }

      await tx.done;
      return {
        importedConversations: data.conversations.length,
        importedMessages: msgCount,
      };
    }),
    clearAll: () => guard(async () => {
      const tx = db.transaction(['conversations', 'messages', 'preferences', 'consents', 'attachments', 'meta'], 'readwrite');
      await Promise.all([
        tx.objectStore('conversations').clear(),
        tx.objectStore('messages').clear(),
        tx.objectStore('preferences').clear(),
        tx.objectStore('consents').clear(),
        tx.objectStore('attachments').clear(),
        tx.objectStore('meta').clear(),
      ]);
      await tx.done;
    }),
    close: () => db.close(),
  };
}
