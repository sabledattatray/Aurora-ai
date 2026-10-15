'use client';
import { memo } from 'react';
import dynamic from 'next/dynamic';
import { toUserFacingError, type ErrorCode, type Message } from '@aurora/core';
// Markdown pipeline is heavy; load it only when an assistant message is rendered.
const Markdown = dynamic(() => import('./Markdown').then((m) => m.Markdown), {
  loading: () => <p className="text-sm text-muted">Loading…</p>,
});
import { CopyButton } from './CopyButton';

const STATUS_LABEL: Record<Message['status'], string | null> = {
  pending: 'Waiting for the model…', streaming: 'Generating…',
  complete: null, interrupted: 'Response interrupted. Partial text kept.', failed: 'Failed',
};

const Row = memo(function Row({ m, onRetry }: { m: Message; onRetry?: (m: Message) => void }) {
  const isUser = m.role === 'user';
  const err = m.errorCode ? toUserFacingError(m.errorCode as ErrorCode) : null;
  return (
    <li className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <article
        aria-label={isUser ? 'You said' : 'Aurora said'}
        className={`max-w-[92%] rounded-2xl px-4 py-3 md:max-w-[85%] ${isUser ? 'bg-surface2' : 'border border-line'}`}
      >
        <p className="mb-1 text-xs font-medium text-muted">{isUser ? 'You' : 'Aurora'}</p>
        {isUser ? <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.content}</p> : <Markdown text={m.content} />}
        {STATUS_LABEL[m.status] && <p className="mt-2 text-xs text-muted">{STATUS_LABEL[m.status]}</p>}
        {err && (
          <p role="alert" className="notice mt-2">
            {err.message} {err.nextStep} {err.dataSent === 'no' ? 'Nothing was sent anywhere.' : ''}
          </p>
        )}
        {!isUser && m.route && (
          <p className="mt-2 text-xs text-muted">
            {m.route === 'device-local' ? 'On-device' : 'Cloud'}{m.modelId ? ` · ${m.modelId}` : ''}
          </p>
        )}
        <div className="mt-1 flex gap-1">
          {m.content && <CopyButton label="Copy message" getText={() => m.content} />}
          {(m.status === 'failed' || m.status === 'interrupted') && onRetry && (
            <button type="button" className="btn-ghost text-xs" onClick={() => onRetry(m)}>Retry</button>
          )}
        </div>
      </article>
    </li>
  );
});

export function MessageList({ messages, onRetry }: { messages: Message[]; onRetry?: (m: Message) => void }) {
  return (
    <ol className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-4" aria-label="Conversation">
      {messages.map((m) => <Row key={m.id} m={m} onRetry={onRetry} />)}
    </ol>
  );
}
