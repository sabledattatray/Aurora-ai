import { defaultSchema } from 'rehype-sanitize';
import type { Options } from 'rehype-sanitize';

const SAFE_PROTOCOLS = ['http', 'https', 'mailto'];

/**
 * Allowlist schema. Differences from the library default:
 *  - link protocols restricted to http, https, mailto
 * <img> passes the sanitizer only so the Markdown component can replace it with a
 * placeholder; the component never renders an <img> or reads its src (tested).
 */
export const sanitizeSchema: Options = {
  ...defaultSchema,
  protocols: { ...defaultSchema.protocols, href: SAFE_PROTOCOLS },
};

export function isSafeHref(href: string | undefined): href is string {
  if (!href) return false;
  try {
    const u = new URL(href, 'https://placeholder.invalid');
    return SAFE_PROTOCOLS.includes(u.protocol.replace(':', ''));
  } catch {
    return false;
  }
}
