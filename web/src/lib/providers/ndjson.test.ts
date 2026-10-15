import { describe, it, expect } from 'vitest';
import { parseNDJSONStream } from './ndjson';

function createStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('NDJSON Stream Parser (PRD 9.6)', () => {
  it('parses complete lines correctly', async () => {
    const stream = createStream(['{"a":1}\n{"a":2}\n']);
    const results: Array<{ a: number }> = [];
    for await (const item of parseNDJSONStream<{ a: number }>(stream)) {
      results.push(item);
    }
    expect(results).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('handles lines split across multiple chunk boundaries', async () => {
    const stream = createStream(['{"text": "Hel', 'lo, w', 'orld!"}\n{"done":', 'true}\n']);
    const results: any[] = [];
    for await (const item of parseNDJSONStream(stream)) {
      results.push(item);
    }
    expect(results).toEqual([
      { text: 'Hello, world!' },
      { done: true },
    ]);
  });

  it('handles multi-byte unicode split across chunks', async () => {
    const encoder = new TextEncoder();
    const fullText = JSON.stringify({ message: 'Hello 🌍 Aurora!' }) + '\n';
    const bytes = encoder.encode(fullText);

    // Split right in the middle of the 4-byte Earth globe emoji (🌍)
    const mid = bytes.indexOf(0x9f); // byte inside the emoji
    const splitIndex = mid > 0 ? mid : 10;

    const chunk1 = bytes.slice(0, splitIndex);
    const chunk2 = bytes.slice(splitIndex);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.close();
      },
    });

    const results: any[] = [];
    for await (const item of parseNDJSONStream(stream)) {
      results.push(item);
    }
    expect(results).toEqual([{ message: 'Hello 🌍 Aurora!' }]);
  });
});
