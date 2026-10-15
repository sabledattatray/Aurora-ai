/**
 * Parses a ReadableStream of newline-delimited JSON (NDJSON) chunks safely (PRD 9.6).
 * Handles partial lines and multi-byte UTF-8 split across chunk boundaries.
 */
export async function* parseNDJSONStream<T = unknown>(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal
): AsyncIterable<T> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      if (signal?.aborted) {
        throw new Error('CANCELLED');
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // The last element is either empty (if ended with newline) or an incomplete line
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed) as T;
          yield parsed;
        } catch {
          // Ignore malformed individual empty or corrupted chunks
        }
      }
    }

    // Flush any remaining buffered characters
    buffer += decoder.decode();
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim()) as T;
        yield parsed;
      } catch {
        // Ignored
      }
    }
  } finally {
    reader.releaseLock();
  }
}
