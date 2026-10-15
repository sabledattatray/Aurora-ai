import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HostedWorkersAIProvider } from './hosted';
import { CURRENT_DISCLOSURE_VERSION, type ConsentRecord } from '@aurora/core';

function makeSseStreamResponse(lines: string[], status = 200) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + '\n\n'));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('HostedWorkersAIProvider (PRD Section 10, AC-04, AC-05)', () => {
  const originalFetch = globalThis.fetch;
  const validConsent: ConsentRecord = {
    id: 'consent-test-1',
    purpose: 'cloud-text',
    scope: { providerId: 'workers-ai' },
    choice: 'granted',
    timestamp: Date.now(),
    disclosureVersion: CURRENT_DISCLOSURE_VERSION,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('getStatus returns reachable when gateway health check succeeds', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const provider = new HostedWorkersAIProvider({ gatewayUrl: '/api', consent: validConsent });
    const status = await provider.getStatus();
    expect(status.state).toBe('reachable');
  });

  it('getStatus returns CONSENT_REQUIRED when consent is absent', async () => {
    const provider = new HostedWorkersAIProvider({ gatewayUrl: '/api', privacyMode: 'ask-before-cloud' });
    const status = await provider.getStatus();
    expect(status.state).toBe('unavailable');
    expect(status.reasonCode).toBe('CONSENT_REQUIRED');
  });

  it('listModels parses model list from gateway', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ models: ['@cf/meta/llama-3-8b-instruct'] }), { status: 200 })
    );
    const provider = new HostedWorkersAIProvider({ gatewayUrl: '/api', consent: validConsent });
    const models = await provider.listModels();
    expect(models.length).toBe(1);
    expect(models[0]?.id).toBe('@cf/meta/llama-3-8b-instruct');
  });

  it('generateStream yields parsed SSE events from gateway stream', async () => {
    const sseLines = [
      'data: {"type":"delta","text":"Hello"}',
      'data: {"type":"delta","text":" world!"}',
      'data: {"type":"done"}',
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(makeSseStreamResponse(sseLines));
    const provider = new HostedWorkersAIProvider({ gatewayUrl: '/api', consent: validConsent });

    const events: any[] = [];
    for await (const ev of provider.generateStream({
      requestId: 'req-cloud-1',
      modelId: '@cf/meta/llama-3-8b-instruct',
      messages: [{ role: 'user', content: 'Hi' }],
      route: 'cloud',
    })) {
      events.push(ev);
    }

    expect(events).toEqual([
      { type: 'delta', text: 'Hello' },
      { type: 'delta', text: ' world!' },
      { type: 'done' },
    ]);
  });

  it('generateStream yields error when consent is missing', async () => {
    const provider = new HostedWorkersAIProvider({ gatewayUrl: '/api', privacyMode: 'ask-before-cloud' });
    const events: any[] = [];

    for await (const ev of provider.generateStream({
      requestId: 'req-cloud-2',
      modelId: '@cf/meta/llama-3-8b-instruct',
      messages: [{ role: 'user', content: 'Hi' }],
      route: 'cloud',
    })) {
      events.push(ev);
    }

    expect(events.length).toBe(1);
    expect(events[0]?.type).toBe('error');
    expect(events[0]?.code).toBe('CONSENT_REQUIRED');
  });
});
