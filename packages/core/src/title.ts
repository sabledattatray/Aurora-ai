import { LIMITS } from './limits';

/** Derive a conversation title locally (no model call, no network). */
export function deriveTitle(firstUserMessage: string): string {
  const flat = firstUserMessage.replace(/\s+/g, ' ').trim();
  if (!flat) return 'New chat';
  if (flat.length <= LIMITS.titleMaxChars) return flat;
  return flat.slice(0, LIMITS.titleMaxChars - 1).trimEnd() + '…';
}

export type SubmitCheck = { ok: true } | { ok: false; reason: 'empty' | 'too-long' };

export function validateUserMessage(text: string): SubmitCheck {
  if (!text.trim()) return { ok: false, reason: 'empty' };
  if (text.length > LIMITS.maxUserMessageChars) return { ok: false, reason: 'too-long' };
  return { ok: true };
}
