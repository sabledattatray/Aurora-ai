import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { createStore, type AuroraStore } from './store';
import { openAuroraDb, mapStorageError, StorageError } from './db';
import type { ConsentRecord } from '@aurora/core';

let store: AuroraStore;
let n = 0;
beforeEach(async () => {
  store = await createStore(`test-${++n}`);
});

describe('conversations', () => {
  it('creates, lists newest-first, renames, deletes', async () => {
    const a = await store.createConversation();
    await new Promise((r) => setTimeout(r, 5));
    const b = await store.createConversation('Second');
    expect((await store.listConversations()).map((c) => c.id)).toEqual([b.id, a.id]);
    await store.renameConversation(a.id, '  Renamed   chat ');
    expect((await store.getConversation(a.id))?.title).toBe('Renamed chat');
    await store.renameConversation(a.id, '   '); // ignored
    expect((await store.getConversation(a.id))?.title).toBe('Renamed chat');
    await store.deleteConversation(a.id);
    expect(await store.getConversation(a.id)).toBeUndefined();
  });

  it('deleting a conversation deletes its messages and only its messages', async () => {
    const a = await store.createConversation();
    const b = await store.createConversation();
    await store.addMessage({ conversationId: a.id, role: 'user', content: 'a1', status: 'complete' });
    await store.addMessage({ conversationId: b.id, role: 'user', content: 'b1', status: 'complete' });
    await store.deleteConversation(a.id);
    expect(await store.listMessages(a.id)).toHaveLength(0);
    expect(await store.listMessages(b.id)).toHaveLength(1);
  });

  it('first user message sets the title once', async () => {
    const c = await store.createConversation();
    await store.addMessage({ conversationId: c.id, role: 'user', content: 'Explain   quantum computing', status: 'complete' });
    await store.addMessage({ conversationId: c.id, role: 'user', content: 'Second', status: 'complete' });
    expect((await store.getConversation(c.id))?.title).toBe('Explain quantum computing');
  });
});

describe('messages', () => {
  it('persists in creation order and supports updates', async () => {
    const c = await store.createConversation();
    const m1 = await store.addMessage({ conversationId: c.id, role: 'user', content: 'hi', status: 'complete', createdAt: 1 });
    await store.addMessage({ conversationId: c.id, role: 'assistant', content: 'par', status: 'streaming', createdAt: 2 });
    const list = await store.listMessages(c.id);
    expect(list.map((m) => m.role)).toEqual(['user', 'assistant']);
    await store.updateMessage(list[1]!.id, { content: 'partial text', status: 'interrupted' });
    const after = await store.listMessages(c.id);
    expect(after[1]).toMatchObject({ content: 'partial text', status: 'interrupted' });
    expect(m1.id).toBeTruthy();
  });
});

describe('search', () => {
  it('matches titles and message content case-insensitively', async () => {
    const a = await store.createConversation('Cooking tips');
    const b = await store.createConversation('Other');
    await store.addMessage({ conversationId: b.id, role: 'user', content: 'Tell me about PHOTOSYNTHESIS', status: 'complete' });
    expect((await store.searchConversations('cook')).map((c) => c.id)).toEqual([a.id]);
    expect((await store.searchConversations('photosynthesis')).map((c) => c.id)).toEqual([b.id]);
    expect(await store.searchConversations('zzz')).toEqual([]);
    expect(await store.searchConversations('  ')).toHaveLength(2);
  });
});

describe('preferences and clearing', () => {
  it('defaults to local-only and persists patches', async () => {
    expect((await store.getPreferences()).privacyMode).toBe('local-only');
    const p = await store.setPreferences({ theme: 'dark' });
    expect(p.theme).toBe('dark');
    expect((await store.getPreferences()).theme).toBe('dark');
    expect((await store.getPreferences()).privacyMode).toBe('local-only');
  });

  it('clearAll wipes everything', async () => {
    const c = await store.createConversation();
    await store.addMessage({ conversationId: c.id, role: 'user', content: 'x', status: 'complete' });
    await store.setPreferences({ theme: 'dark' });
    await store.clearAll();
    expect(await store.listConversations()).toEqual([]);
    expect(await store.listMessages(c.id)).toEqual([]);
    expect((await store.getPreferences()).theme).toBe('system');
  });

  it('data survives closing and reopening the database', async () => {
    const name = `persist-${++n}`;
    const s1 = await createStore(name);
    const c = await s1.createConversation('Keep me');
    s1.close();
    const s2 = await createStore(name);
    expect((await s2.getConversation(c.id))?.title).toBe('Keep me');
  });
});

describe('consents storage', () => {
  it('saves, lists and revokes consents', async () => {
    const consent: ConsentRecord = {
      id: 'c-test-1',
      purpose: 'cloud-text',
      scope: { conversationId: 'conv-1', providerId: 'workers-ai' },
      choice: 'granted',
      timestamp: Date.now(),
      disclosureVersion: '1.0',
    };
    await store.saveConsent(consent);
    const list = await store.listConsents();
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe('c-test-1');
    expect(list[0]?.revokedAt).toBeUndefined();

    await store.revokeConsent('c-test-1');
    const after = await store.listConsents();
    expect(after[0]?.revokedAt).toBeDefined();
  });
});

describe('error mapping', () => {
  it('maps quota and unknown errors', () => {
    expect(mapStorageError({ name: 'QuotaExceededError' }).code).toBe('STORAGE_QUOTA_EXCEEDED');
    expect(mapStorageError(new Error('boom')).code).toBe('STORAGE_UNAVAILABLE');
    expect(mapStorageError(new StorageError('STORAGE_UNAVAILABLE')).code).toBe('STORAGE_UNAVAILABLE');
  });
  it('reports unavailable when IndexedDB is missing', async () => {
    const saved = globalThis.indexedDB;
    // @ts-expect-error simulate blocked storage
    delete globalThis.indexedDB;
    await expect(openAuroraDb('x')).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
    globalThis.indexedDB = saved;
  });
});
