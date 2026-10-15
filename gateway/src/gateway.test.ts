import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleGatewayRequest, type GatewayEnv } from './index';
import { CURRENT_DISCLOSURE_VERSION } from '@aurora/core';

describe('Gateway Worker (PRD Section 10, AC-04, AC-05, AC-13, AC-20)', () => {
  const originalFetch = globalThis.fetch;
  const mockEnv: GatewayEnv = {
    ALLOWED_ORIGINS: 'http://localhost:3000',
    HOSTED_PROVIDER_ACCOUNT_ID: 'test-account-id',
    HOSTED_PROVIDER_API_TOKEN: 'test-api-token',
    RATE_LIMIT_MAX_REQUESTS: '10',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('GET /api/health returns ok status without secrets', async () => {
    const req = new Request('http://localhost:8787/api/health', {
      method: 'GET',
      headers: { Origin: 'http://localhost:3000' },
    });
    const res = await handleGatewayRequest(req, mockEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    const data = await res.json();
    expect(data).toEqual({ ok: true, version: '0.1.0' });
    expect(JSON.stringify(data)).not.toContain('test-api-token');
  });

  it('OPTIONS preflight returns 204 with CORS headers (AC-20)', async () => {
    const req = new Request('http://localhost:8787/api/chat', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:3000' },
    });
    const res = await handleGatewayRequest(req, mockEnv);
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('GET /api/models returns model allowlist', async () => {
    const req = new Request('http://localhost:8787/api/models', {
      method: 'GET',
      headers: { Origin: 'http://localhost:3000' },
    });
    const res = await handleGatewayRequest(req, mockEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    const data = (await res.json()) as { models: string[] };
    expect(Array.isArray(data.models)).toBe(true);
    expect(data.models.length).toBeGreaterThan(0);
  });

  it('POST /api/chat rejects request missing X-Aurora-Consent header (AC-04)', async () => {
    const req = new Request('http://localhost:8787/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        requestId: 'req-1',
        modelId: '@cf/meta/llama-3-8b-instruct',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    const res = await handleGatewayRequest(req, mockEnv);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('CONSENT_REQUIRED');
  });

  it('POST /api/chat rejects unauthorized origin (AC-20)', async () => {
    const req = new Request('http://localhost:8787/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://malicious-site.example.com',
        'X-Aurora-Consent': CURRENT_DISCLOSURE_VERSION,
      },
      body: JSON.stringify({
        requestId: 'req-1',
        modelId: '@cf/meta/llama-3-8b-instruct',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    const res = await handleGatewayRequest(req, mockEnv);
    expect(res.status).toBe(403);
  });

  it('POST /api/chat fails with PROVIDER_NOT_CONFIGURED when server secrets are missing (AC-13)', async () => {
    const envNoSecret: GatewayEnv = {
      ALLOWED_ORIGINS: 'http://localhost:3000',
    };

    const req = new Request('http://localhost:8787/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        'X-Aurora-Consent': CURRENT_DISCLOSURE_VERSION,
      },
      body: JSON.stringify({
        requestId: 'req-1',
        modelId: '@cf/meta/llama-3-8b-instruct',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    const res = await handleGatewayRequest(req, envNoSecret);
    expect(res.status).toBe(503);
    const data = (await res.json()) as { error: { code: string } };
    expect(data.error.code).toBe('PROVIDER_NOT_CONFIGURED');
  });

  it('POST /api/chat streams SSE events from upstream Cloudflare Workers AI', async () => {
    const sseLines = [
      'data: {"response":"Cloud"}',
      'data: {"response":" response"}',
      'data: [DONE]',
    ];
    const encoder = new TextEncoder();
    const mockUpstreamStream = new ReadableStream({
      start(controller) {
        for (const line of sseLines) {
          controller.enqueue(encoder.encode(line + '\n\n'));
        }
        controller.close();
      },
    });

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(mockUpstreamStream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      })
    );

    const req = new Request('http://localhost:8787/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        'X-Aurora-Consent': CURRENT_DISCLOSURE_VERSION,
      },
      body: JSON.stringify({
        requestId: 'req-1',
        modelId: '@cf/meta/llama-3-8b-instruct',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    });

    const res = await handleGatewayRequest(req, mockEnv);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const text = await res.text();
    expect(text).toContain('data: {"type":"delta","text":"Cloud"}');
    expect(text).toContain('data: {"type":"done"}');
  });

  it('Kill switch returns 503 service unavailable (PRD 10.5)', async () => {
    const killEnv: GatewayEnv = { ...mockEnv, KILL_SWITCH: 'true' };
    const req = new Request('http://localhost:8787/api/chat', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000' },
    });
    const res = await handleGatewayRequest(req, killEnv);
    expect(res.status).toBe(503);
  });
});
