'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LIMITS, validateUserMessage } from '@aurora/core';
import { shouldSendOnEnter } from '@/lib/composer';

const draftKey = (id: string) => `aurora:draft:${id}`;

export function Composer(props: {
  conversationId: string;
  /** When set, the composer is disabled and this is shown as the reason. */
  disabledReason?: string;
  generating?: boolean;
  /** Resolve true only once the provider has accepted the request; draft is then cleared. */
  onSend: (text: string) => Promise<boolean>;
  onStop?: () => void;
}) {
  const { conversationId } = props;
  // Parents render <Composer key={conversationId}>, so this initializer runs per conversation.
  const [text, setText] = useState(() => {
    try { return sessionStorage.getItem(draftKey(conversationId)) ?? ''; } catch { return ''; }
  });
  const [hint, setHint] = useState<string | null>(null);
  const inFlight = useRef(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      if (text) sessionStorage.setItem(draftKey(conversationId), text);
      else sessionStorage.removeItem(draftKey(conversationId));
    } catch { /* storage blocked: draft just won't persist across reloads */ }
  }, [text, conversationId]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const disabled = !!props.disabledReason;
  const remaining = LIMITS.maxUserMessageChars - text.length;

  const submit = async () => {
    if (disabled || props.generating || inFlight.current) return;
    const v = validateUserMessage(text);
    if (!v.ok) {
      setHint(v.reason === 'empty' ? 'Type a message first.' : 'That message is too long. Please shorten it.');
      return;
    }
    inFlight.current = true;
    setHint(null);
    try {
      const accepted = await props.onSend(text); // draft stays until accepted
      if (accepted) setText('');
    } finally {
      inFlight.current = false;
    }
  };

  return (
    <div className="border-t border-line bg-bg px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-3xl">
        {props.disabledReason && (
          <p className="notice mb-2" id="composer-reason">
            {props.disabledReason} <Link href="/help/" className="underline">Setup guide</Link>
          </p>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="composer" className="sr-only">Message</label>
            <textarea
              id="composer" ref={taRef} rows={1} className="field resize-none" value={text}
              placeholder={disabled ? 'No model available' : 'Message Aurora'}
              disabled={disabled}
              aria-describedby={props.disabledReason ? 'composer-reason' : hint ? 'composer-hint' : undefined}
              onChange={(e) => { setText(e.target.value); setHint(null); }}
              onKeyDown={(e) => {
                const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
                if (shouldSendOnEnter({ key: e.key, shiftKey: e.shiftKey, isComposing: e.nativeEvent.isComposing, coarsePointer: coarse, ctrlKey: e.ctrlKey, metaKey: e.metaKey })) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
          </div>
          {props.generating ? (
            <button type="button" className="btn" onClick={props.onStop} aria-label="Stop generating">■ Stop</button>
          ) : (
            <button type="button" className="btn-primary" disabled={disabled || !text.trim()} onClick={() => void submit()} aria-label="Send message">Send</button>
          )}
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span id="composer-hint" role={hint ? 'alert' : undefined}>{hint}</span>
          {remaining < 2000 && <span>{remaining.toLocaleString()} characters left</span>}
        </div>
        <p className="mt-1 text-center text-xs text-muted">Aurora can be wrong. Check important information.</p>
      </div>
    </div>
  );
}
