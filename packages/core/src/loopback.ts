/**
 * Strict loopback address verification for local inference endpoints (PRD 9.4).
 * Prevents SSRF and unauthorized LAN/WAN access.
 */
export function isLoopbackEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    // Protocol must be http or https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false;
    }
    const host = url.hostname.toLowerCase();
    return (
      host === '127.0.0.1' ||
      host === 'localhost' ||
      host === '::1' ||
      host === '[::1]'
    );
  } catch {
    return false;
  }
}

export function validateLocalEndpoint(endpoint: string): { ok: true } | { ok: false; error: string } {
  if (!endpoint || !endpoint.trim()) {
    return { ok: false, error: 'Endpoint URL cannot be empty.' };
  }
  if (!isLoopbackEndpoint(endpoint)) {
    return {
      ok: false,
      error: 'Only loopback endpoints (127.0.0.1, localhost, [::1]) are permitted for local inference.',
    };
  }
  return { ok: true };
}
