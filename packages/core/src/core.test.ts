import { describe, it, expect } from 'vitest';
import {
  ALL_ERROR_CODES,
  toUserFacingError,
  deriveTitle,
  validateUserMessage,
  LIMITS,
  isLoopbackEndpoint,
  validateLocalEndpoint,
  buildContextWindow,
  routeRequest,
  isConsentValid,
  CURRENT_DISCLOSURE_VERSION,
  type ConsentRecord,
} from './index';

describe('errors', () => {
  it('every code has a complete user-facing message', () => {
    for (const c of ALL_ERROR_CODES) {
      const e = toUserFacingError(c);
      expect(e.message.length).toBeGreaterThan(5);
      expect(e.nextStep.length).toBeGreaterThan(5);
      expect(e.promptKept).toBe(true);
    }
  });
  it('local-only unreachable states never claim data was sent', () => {
    expect(toUserFacingError('PROVIDER_UNAVAILABLE').dataSent).toBe('no');
    expect(toUserFacingError('PROVIDER_NOT_CONFIGURED').dataSent).toBe('no');
  });
});

describe('deriveTitle', () => {
  it('handles empty, short, whitespace, and long input', () => {
    expect(deriveTitle('   ')).toBe('New chat');
    expect(deriveTitle('Hello\n  world')).toBe('Hello world');
    const t = deriveTitle('x'.repeat(200));
    expect(t.length).toBe(LIMITS.titleMaxChars);
    expect(t.endsWith('…')).toBe(true);
  });
});

describe('validateUserMessage', () => {
  it('rejects empty and oversized', () => {
    expect(validateUserMessage('  ')).toEqual({ ok: false, reason: 'empty' });
    expect(validateUserMessage('a'.repeat(LIMITS.maxUserMessageChars + 1))).toEqual({ ok: false, reason: 'too-long' });
    expect(validateUserMessage('hi')).toEqual({ ok: true });
  });
});

describe('loopback validation', () => {
  it('accepts valid loopback endpoints', () => {
    expect(isLoopbackEndpoint('http://127.0.0.1:11434')).toBe(true);
    expect(isLoopbackEndpoint('http://localhost:11434')).toBe(true);
    expect(isLoopbackEndpoint('http://[::1]:11434')).toBe(true);
    expect(validateLocalEndpoint('http://127.0.0.1:11434').ok).toBe(true);
  });

  it('rejects non-loopback addresses for SSRF protection', () => {
    expect(isLoopbackEndpoint('http://192.168.1.100:11434')).toBe(false);
    expect(isLoopbackEndpoint('https://api.openai.com')).toBe(false);
    expect(isLoopbackEndpoint('ftp://127.0.0.1')).toBe(false);
    expect(isLoopbackEndpoint('not-a-url')).toBe(false);
    expect(validateLocalEndpoint('http://10.0.0.1:11434').ok).toBe(false);
  });
});

describe('context window management (AC-19)', () => {
  it('includes all messages when well within budget', () => {
    const msgs = [
      { role: 'user' as const, content: 'First message' },
      { role: 'assistant' as const, content: 'First response' },
      { role: 'user' as const, content: 'Second message' },
    ];
    const res = buildContextWindow(msgs, {
      modelContextTokens: 4096,
      reservedOutputTokens: 1024,
      systemPrompt: 'System instruction',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.context.droppedCount).toBe(0);
    expect(res.context.notice).toBeUndefined();
    expect(res.context.messages.length).toBe(4); // system + 3 turns
    expect(res.context.messages[0]?.role).toBe('system');
    expect(res.context.messages[3]?.content).toBe('Second message');
  });

  it('drops oldest turns first and sets visible persistent notice when exceeding budget', () => {
    // 500 chars is ~125 tokens each
    const msgs = [
      { role: 'user' as const, content: 'Message 1 '.repeat(50) },
      { role: 'assistant' as const, content: 'Message 2 '.repeat(50) },
      { role: 'user' as const, content: 'Message 3 '.repeat(50) },
      { role: 'assistant' as const, content: 'Message 4 '.repeat(50) },
      { role: 'user' as const, content: 'Latest message' },
    ];

    // Budget of 600 tokens total - 200 reserved = 400 available
    const res = buildContextWindow(msgs, {
      modelContextTokens: 600,
      reservedOutputTokens: 200,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.context.droppedCount).toBeGreaterThan(0);
    expect(res.context.notice).toContain('Earlier messages');
    // Latest message must always be preserved
    expect(res.context.messages[res.context.messages.length - 1]?.content).toBe('Latest message');
  });

  it('fails with CONTEXT_EXCEEDED when a single message exceeds total budget', () => {
    const hugeMsg = [{ role: 'user' as const, content: 'A'.repeat(5000) }]; // ~1250 tokens
    const res = buildContextWindow(hugeMsg, {
      modelContextTokens: 1024,
      reservedOutputTokens: 512, // budget is 512 tokens
    });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toBe('CONTEXT_EXCEEDED');
  });
});

describe('privacy router and consent (AC-03, AC-04)', () => {
  it('Local-only mode strictly forbids cloud routes', () => {
    const res = routeRequest({
      privacyMode: 'local-only',
      target: { route: 'cloud', providerId: 'workers-ai', modelId: '@cf/meta/llama-3' },
    });
    expect(res.allowed).toBe(false);
    if (res.allowed) return;
    expect(res.code).toBe('CONSENT_REQUIRED');
  });

  it('Local-only allows configured local model', () => {
    const res = routeRequest({
      privacyMode: 'local-only',
      target: { route: 'device-local', providerId: 'ollama', modelId: 'llama3:latest' },
    });
    expect(res.allowed).toBe(true);
    if (!res.allowed) return;
    expect(res.route).toBe('device-local');
  });

  it('Local-only fails when local model is not configured', () => {
    const res = routeRequest({
      privacyMode: 'local-only',
      target: { route: 'device-local', providerId: 'ollama', modelId: '' },
    });
    expect(res.allowed).toBe(false);
    if (res.allowed) return;
    expect(res.code).toBe('PROVIDER_NOT_CONFIGURED');
  });

  it('Ask-before-cloud blocks cloud route without valid consent', () => {
    const res = routeRequest({
      privacyMode: 'ask-before-cloud',
      target: { route: 'cloud', providerId: 'workers-ai', modelId: 'llama-3' },
      conversationId: 'conv-123',
    });
    expect(res.allowed).toBe(false);
    if (res.allowed) return;
    expect(res.code).toBe('CONSENT_REQUIRED');
  });

  it('Ask-before-cloud allows cloud route with valid unrevoked consent', () => {
    const validConsent: ConsentRecord = {
      id: 'consent-1',
      purpose: 'cloud-text',
      scope: { conversationId: 'conv-123', providerId: 'workers-ai' },
      choice: 'granted',
      timestamp: Date.now(),
      disclosureVersion: CURRENT_DISCLOSURE_VERSION,
    };

    const res = routeRequest({
      privacyMode: 'ask-before-cloud',
      target: { route: 'cloud', providerId: 'workers-ai', modelId: 'llama-3' },
      conversationId: 'conv-123',
      consents: [validConsent],
    });

    expect(res.allowed).toBe(true);
    if (!res.allowed) return;
    expect(res.route).toBe('cloud');
  });

  it('Expired disclosure version or revoked consent invalidates consent', () => {
    const expiredConsent: ConsentRecord = {
      id: 'consent-2',
      purpose: 'cloud-text',
      scope: { conversationId: 'conv-123', providerId: 'workers-ai' },
      choice: 'granted',
      timestamp: Date.now(),
      disclosureVersion: '0.9', // outdated
    };
    expect(isConsentValid(expiredConsent, 'cloud-text', 'conv-123')).toBe(false);

    const revokedConsent: ConsentRecord = {
      id: 'consent-3',
      purpose: 'cloud-text',
      scope: { conversationId: 'conv-123', providerId: 'workers-ai' },
      choice: 'granted',
      timestamp: Date.now(),
      disclosureVersion: CURRENT_DISCLOSURE_VERSION,
      revokedAt: Date.now(),
    };
    expect(isConsentValid(revokedConsent, 'cloud-text', 'conv-123')).toBe(false);
  });
});
