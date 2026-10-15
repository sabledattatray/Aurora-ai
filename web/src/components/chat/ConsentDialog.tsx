'use client';
import { useState } from 'react';
import { CURRENT_DISCLOSURE_VERSION, type ConsentRecord } from '@aurora/core';

export interface ConsentDialogProps {
  open: boolean;
  providerId: string;
  providerName: string;
  providerCompany: string;
  providerTermsUrl: string;
  conversationId: string;
  previewText: string;
  onGrant: (record: ConsentRecord) => void;
  onDeny: () => void;
}

export function ConsentDialog(props: ConsentDialogProps) {
  const {
    open,
    providerId,
    providerName,
    providerCompany,
    providerTermsUrl,
    conversationId,
    previewText,
    onGrant,
    onDeny,
  } = props;

  const [showPreview, setShowPreview] = useState(false);

  if (!open) return null;

  const handleGrant = (scope: 'conversation' | 'once') => {
    const record: ConsentRecord = {
      id: crypto.randomUUID(),
      purpose: 'cloud-text',
      scope: {
        providerId,
        conversationId: scope === 'conversation' ? conversationId : undefined,
      },
      choice: 'granted',
      timestamp: Date.now(),
      disclosureVersion: CURRENT_DISCLOSURE_VERSION,
    };
    onGrant(record);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <h2 id="consent-title" className="text-xl font-semibold">
          Allow sending text to an online provider?
        </h2>

        <div className="mt-3 space-y-3 text-sm text-muted">
          <p>
            You have chosen to use <strong>{providerName}</strong> (provided by {providerCompany}).
            To generate a response, the text of this conversation within the context window will be transmitted to this provider.
          </p>

          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Aurora&apos;s gateway does not retain, log, or store your prompts or answers.</li>
            <li>The online provider&apos;s privacy policy applies:{' '}
              <a href={providerTermsUrl} target="_blank" rel="noopener noreferrer" className="underline">
                {providerCompany} Privacy Terms
              </a>.
            </li>
            <li>Free allowances are subject to provider rate limits and availability.</li>
            <li>You can revoke this permission at any time in <strong>Settings &gt; Privacy</strong>.</li>
          </ul>

          <div className="pt-1">
            <button
              type="button"
              className="text-xs text-accent underline"
              onClick={() => setShowPreview((s) => !s)}
            >
              {showPreview ? 'Hide what will be sent' : 'Preview what will be sent'}
            </button>
            {showPreview && (
              <pre className="mt-2 max-h-40 overflow-y-auto rounded bg-surface2 p-3 text-xs leading-relaxed text-text">
                {previewText || '(Empty message)'}
              </pre>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn" onClick={onDeny}>
            Stay on-device
          </button>
          <button type="button" className="btn" onClick={() => handleGrant('once')}>
            Send once
          </button>
          <button type="button" className="btn-primary" onClick={() => handleGrant('conversation')}>
            Allow for this conversation
          </button>
        </div>
      </div>
    </div>
  );
}
