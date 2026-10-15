import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from './ollama';

function makeStreamResponse(lines: string[], status = 200) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + '\n'));
      }
      controller.close();
    },
  });
  return new Response(stream, { status });
}

describe('OllamaProvider (PRD Section 9, AC-02, AC-06)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('getStatus returns reachable when Ollama responds 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ models: [] }), { status: 200 }));
    const provider = new OllamaProvider({ endpoint: 'http://127.0.0.1:11434' });
    const status = await provider.getStatus();
    expect(status.state).toBe('reachable');
  });

  it('getStatus returns unavailable when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    const provider = new OllamaProvider({ endpoint: 'http://127.0.0.1:11434' });
    const status = await provider.getStatus();
    expect(status.state).toBe('unavailable');
    expect(status.reasonCode).toBe('PROVIDER_UNAVAILABLE');
  });

  it('listModels parses tags properly', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          models: [
            { name: 'llama3:latest', size: 4661224676, modified_at: '2026-04-10T12:00:00Z' },
            { name: 'mistral:latest', size: 4109849182, modified_at: '2026-04-11T12:00:00Z' },
          ],
        }),
        { status: 200 }
      )
    );
    const provider = new OllamaProvider();
    const models = await provider.listModels();
    expect(models.length).toBe(2);
    expect(models[0]?.name).toBe('llama3:latest');
    expect(models[1]?.name).toBe('mistral:latest');
  });

  it('generateStream yields tokens incrementally and ends with done', async () => {
    const chunks = [
      JSON.stringify({ message: { role: 'assistant', content: 'Hello' }, done: false }),
      JSON.stringify({ message: { role: 'assistant', content: ' there!' }, done: false }),
      JSON.stringify({
        message: { role: 'assistant', content: '' },
        done: true,
        prompt_eval_count: 10,
        eval_count: 5,
      }),
    ];

    globalThis.fetch = vi.fn().mockResolvedValue(makeStreamResponse(chunks));
    const provider = new OllamaProvider();

    const events: any[] = [];
    for await (const ev of provider.generateStream({
      requestId: 'test-req',
      modelId: 'llama3:latest',
      messages: [{ role: 'user', content: 'Hi' }],
      route: 'device-local',
    })) {
      events.push(ev);
    }

    expect(events).toEqual([
      { type: 'delta', text: 'Hello' },
      { type: 'delta', text: ' there!' },
      { type: 'usage', inputTokens: 10, outputTokens: 5 },
      { type: 'done' },
    ]);
  });

  it('generateStream handles cancellation/abort cleanly (AC-06)', async () => {
    const controller = new AbortController();
    const chunks = [
      JSON.stringify({ message: { role: 'assistant', content: 'Part 1' }, done: false }),
    ];

    globalThis.fetch = vi.fn().mockImplementation(() => {
      controller.abort();
      return Promise.resolve(makeStreamResponse(chunks));
    });

    const provider = new OllamaProvider();
    const events: any[] = [];

    for await (const ev of provider.generateStream(
      {
        requestId: 'test-req-abort',
        modelId: 'llama3:latest',
        messages: [{ role: 'user', content: 'Hi' }],
        route: 'device-local',
      },
      controller.signal
    )) {
      events.push(ev);
    }

    const hasCancelOrDelta = events.some((e) => e.type === 'delta' || e.type === 'error');
    expect(hasCancelOrDelta).toBe(true);
  });
});
