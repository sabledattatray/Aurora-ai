import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendNetworkRequest, GatewayPrivacyError } from './gateway';
import { CURRENT_DISCLOSURE_VERSION, type ConsentRecord } from '@aurora/core';

describe('Network Gateway (PRD 7.11 & AC-03)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('blocks cloud request when privacy mode is local-only', async () => {
    await expect(
      sendNetworkRequest({
        route: 'cloud',
        privacyMode: 'local-only',
        url: 'https://gateway.example.com/api/chat',
      })
    ).rejects.toThrow(GatewayPrivacyError);

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('blocks non-loopback endpoints for local route', async () => {
    await expect(
      sendNetworkRequest({
        route: 'device-local',
        privacyMode: 'local-only',
        url: 'http://192.168.1.50:11434/api/tags',
      })
    ).rejects.toThrow(GatewayPrivacyError);

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('allows loopback endpoints for local route in local-only mode', async () => {
    const res = await sendNetworkRequest({
      route: 'device-local',
      privacyMode: 'local-only',
      url: 'http://127.0.0.1:11434/api/tags',
    });

    expect(res).toBeDefined();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/tags',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('blocks cloud request in ask-before-cloud if consent is missing', async () => {
    await expect(
      sendNetworkRequest({
        route: 'cloud',
        privacyMode: 'ask-before-cloud',
        url: 'https://gateway.example.com/api/chat',
      })
    ).rejects.toThrow(GatewayPrivacyError);

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('allows cloud request in ask-before-cloud when valid consent is supplied', async () => {
    const consent: ConsentRecord = {
      id: 'c-1',
      purpose: 'cloud-text',
      scope: { conversationId: 'conv-1', providerId: 'workers-ai' },
      choice: 'granted',
      timestamp: Date.now(),
      disclosureVersion: CURRENT_DISCLOSURE_VERSION,
    };

    const res = await sendNetworkRequest({
      route: 'cloud',
      privacyMode: 'ask-before-cloud',
      url: 'https://gateway.example.com/api/chat',
      consent,
      conversationId: 'conv-1',
    });

    expect(res).toBeDefined();
    expect(globalThis.fetch).toHaveBeenCalled();
  });
});
