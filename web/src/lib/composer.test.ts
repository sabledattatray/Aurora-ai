import { describe, it, expect } from 'vitest';
import { shouldSendOnEnter } from './composer';

const base = { key: 'Enter', shiftKey: false, isComposing: false, coarsePointer: false };
describe('shouldSendOnEnter', () => {
  it('sends on plain Enter on desktop', () => expect(shouldSendOnEnter(base)).toBe(true));
  it('Shift+Enter inserts newline', () => expect(shouldSendOnEnter({ ...base, shiftKey: true })).toBe(false));
  it('does not send during IME composition', () => expect(shouldSendOnEnter({ ...base, isComposing: true })).toBe(false));
  it('ignores other keys', () => expect(shouldSendOnEnter({ ...base, key: 'a' })).toBe(false));
  it('on touch devices Enter is a newline unless Ctrl/Cmd held', () => {
    expect(shouldSendOnEnter({ ...base, coarsePointer: true })).toBe(false);
    expect(shouldSendOnEnter({ ...base, coarsePointer: true, ctrlKey: true })).toBe(true);
  });
});
