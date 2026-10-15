import { describe, it, expect } from 'vitest';
import { validateImportData, EXPORT_FORMAT, CURRENT_EXPORT_VERSION } from './export-import';

describe('Export-Import Schema Validation (PRD 11.4, AC-07)', () => {
  it('accepts valid export payload and produces correct preview summary', () => {
    const valid = {
      format: EXPORT_FORMAT,
      version: CURRENT_EXPORT_VERSION,
      exportedAt: 1713000000000,
      app: { name: 'Aurora AI', version: '0.1.0' },
      conversations: [
        {
          id: 'conv-1',
          title: 'Test chat',
          createdAt: 1000,
          updatedAt: 2000,
          messages: [
            { id: 'm-1', role: 'user', content: 'hello', createdAt: 1000, status: 'complete' },
            { id: 'm-2', role: 'assistant', content: 'hi', createdAt: 1500, status: 'complete' },
          ],
        },
      ],
    };

    const res = validateImportData(valid);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.summary.conversationsCount).toBe(1);
    expect(res.summary.messagesCount).toBe(2);
    expect(res.summary.oldestTimestamp).toBe(1000);
    expect(res.summary.newestTimestamp).toBe(1500);
  });

  it('rejects future schema versions with clear update instruction', () => {
    const future = {
      format: EXPORT_FORMAT,
      version: 999,
      conversations: [],
    };
    const res = validateImportData(future);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain('newer version of Aurora');
  });

  it('rejects invalid format strings or missing required fields', () => {
    expect(validateImportData({ format: 'chatgpt-export' }).ok).toBe(false);
    expect(validateImportData({ format: EXPORT_FORMAT, version: 1, conversations: 'not-an-array' }).ok).toBe(false);
    expect(validateImportData(null).ok).toBe(false);
    expect(validateImportData('string').ok).toBe(false);
  });

  it('rejects invalid message roles or malformed messages', () => {
    const invalidRole = {
      format: EXPORT_FORMAT,
      version: 1,
      conversations: [
        {
          id: 'c-1',
          title: 'Chat',
          createdAt: 1,
          updatedAt: 1,
          messages: [{ id: 'm-1', role: 'malicious-role', content: 'test', createdAt: 1 }],
        },
      ],
    };
    const res = validateImportData(invalidRole);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain('invalid role');
  });
});
