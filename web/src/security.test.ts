import { describe, it, expect, vi } from 'vitest';
import { sendNetworkRequest, GatewayPrivacyError } from './lib/net/gateway';
import { isSafeHref } from './lib/markdown-schema';
import fs from 'node:fs';
import path from 'node:path';

describe('Security Verification (PRD Section 16 & 18.4, AC-03, AC-10, AC-13)', () => {
  it('AC-03: Local-only mode guarantees zero outbound calls to cloud services', async () => {
    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    try {
      await expect(
        sendNetworkRequest({
          route: 'cloud',
          privacyMode: 'local-only',
          url: 'https://gateway.example.com/api/chat',
        })
      ).rejects.toThrow(GatewayPrivacyError);

      await expect(
        sendNetworkRequest({
          route: 'device-local',
          privacyMode: 'local-only',
          url: 'https://external-api.com/chat',
        })
      ).rejects.toThrow(GatewayPrivacyError);

      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('AC-10: Hostile markdown and links neutralise XSS and javascript: URLs', () => {
    // Sanitizer rejects javascript: links
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isSafeHref('vbscript:msgbox(1)')).toBe(false);

    // Allows safe protocols
    expect(isSafeHref('https://example.com')).toBe(true);
    expect(isSafeHref('http://127.0.0.1:11434')).toBe(true);
    expect(isSafeHref('mailto:test@example.com')).toBe(true);
  });

  it('AC-13: Client bundle contains no server credentials or private env vars', () => {
    const forbiddenPatterns = [
      /CLOUDFLARE_API_KEY/i,
      /HOSTED_PROVIDER_API_TOKEN\s*=\s*['"][a-zA-Z0-9_\-]{20,}['"]/i,
      /AWS_SECRET_ACCESS_KEY/i,
      /OPENAI_API_KEY/i,
    ];

    const srcDir = path.resolve(__dirname);
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];

    for (const file of files) {
      if (typeof file !== 'string') continue;
      if (file.includes('security.test')) continue; // Do not scan test definitions
      if (!file.endsWith('.ts') && !file.endsWith('.tsx') && !file.endsWith('.js')) continue;

      const fullPath = path.join(srcDir, file);
      const content = fs.readFileSync(fullPath, 'utf8');

      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content)).toBe(false);
      }
    }
  });
});
