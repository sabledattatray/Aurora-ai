'use client';
import { useState } from 'react';

export function CopyButton({ getText, label }: { getText: () => string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <button
      type="button"
      className="btn-ghost text-xs"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(getText());
          setState('copied');
        } catch {
          setState('failed');
        }
        setTimeout(() => setState('idle'), 1800);
      }}
    >
      {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}
    </button>
  );
}
