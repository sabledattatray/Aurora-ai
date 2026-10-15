/** Enter handling for the composer (PRD 6.5). Pure so it can be unit tested. */
export function shouldSendOnEnter(e: {
  key: string; shiftKey: boolean; isComposing: boolean; coarsePointer: boolean;
  ctrlKey?: boolean; metaKey?: boolean;
}): boolean {
  if (e.key !== 'Enter') return false;
  if (e.isComposing) return false; // IME composition
  if (e.shiftKey) return false;
  if (e.coarsePointer) return !!(e.ctrlKey || e.metaKey); // soft keyboards: Enter = newline
  return true;
}
