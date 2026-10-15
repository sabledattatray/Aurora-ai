import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { createStore } from './store';
import { validateImportData } from '@aurora/core';

describe('Storage Export/Import Round-Trip (PRD 11.4 & AC-07)', () => {
  it('export -> clear -> import preserves all conversations and messages identically', async () => {
    const store = await createStore('test-roundtrip');

    // 1. Seed store with 2 conversations and multiple messages
    const conv1 = await store.createConversation('First conversation');
    await store.addMessage({
      conversationId: conv1.id,
      role: 'user',
      content: 'What is photosynthesis?',
      status: 'complete',
      createdAt: 1000,
    });
    await store.addMessage({
      conversationId: conv1.id,
      role: 'assistant',
      content: 'Photosynthesis is the process used by plants...',
      status: 'complete',
      createdAt: 1005,
      route: 'device-local',
      modelId: 'llama3:latest',
    });

    const conv2 = await store.createConversation('Second conversation');
    await store.addMessage({
      conversationId: conv2.id,
      role: 'user',
      content: 'Write a poem about privacy.',
      status: 'complete',
      createdAt: 2000,
    });

    // 2. Export
    const exportedData = await store.exportData();
    expect(exportedData.conversations.length).toBe(2);

    // 3. Schema validation check
    const validation = validateImportData(exportedData);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    // 4. Clear everything
    await store.clearAll();
    expect((await store.listConversations()).length).toBe(0);

    // 5. Import
    const importRes = await store.importData(validation.data);
    expect(importRes.importedConversations).toBe(2);
    expect(importRes.importedMessages).toBe(3);

    // 6. Verify identical content restored
    const restoredConvs = await store.listConversations();
    expect(restoredConvs.length).toBe(2);

    const restoredTitles = restoredConvs.map((c) => c.title).sort();
    expect(restoredTitles).toEqual(['First conversation', 'Second conversation']);

    // Check message contents for the first conversation
    const c1 = restoredConvs.find((c) => c.title === 'First conversation')!;
    const c1Messages = await store.listMessages(c1.id);
    expect(c1Messages.length).toBe(2);
    expect(c1Messages[0]?.content).toBe('What is photosynthesis?');
    expect(c1Messages[1]?.content).toBe('Photosynthesis is the process used by plants...');
    expect(c1Messages[1]?.route).toBe('device-local');
  });
});
