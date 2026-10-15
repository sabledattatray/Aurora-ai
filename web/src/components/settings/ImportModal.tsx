'use client';
import { useState } from 'react';
import { validateImportData, type AuroraExportData, type ImportPreviewSummary } from '@aurora/core';
import { useApp } from '@/components/AppProvider';

export function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { store, refresh } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    data: AuroraExportData;
    summary: ImportPreviewSummary;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  if (!open) return null;

  const handleFile = (file: File) => {
    setError(null);
    setSuccess(null);
    setPreview(null);

    if (file.size > 50 * 1024 * 1024) {
      setError('File exceeds maximum allowed import size of 50 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        const res = validateImportData(parsed);
        if (!res.ok) {
          setError(res.error);
        } else {
          setPreview({ data: res.data, summary: res.summary });
        }
      } catch {
        setError('Could not parse file as JSON. Please ensure it is a valid export file.');
      }
    };
    reader.onerror = () => {
      setError('Error reading file.');
    };
    reader.readAsText(file);
  };

  const handleCommit = async () => {
    if (!store || !preview) return;
    setImporting(true);
    setError(null);
    try {
      const res = await store.importData(preview.data);
      await refresh();
      setSuccess(`Successfully imported ${res.importedConversations} conversations (${res.importedMessages} messages).`);
      setPreview(null);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch {
      setError('Failed to import conversations into browser storage.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <h2 id="import-title" className="text-xl font-semibold">
          Import Conversations
        </h2>

        <div className="mt-3 space-y-3 text-sm text-muted">
          <p>
            Select an Aurora export file (<code className="rounded bg-surface2 px-1">.json</code>) to restore your conversations.
            Conversations will be imported as new chats without overwriting existing ones.
          </p>

          <input
            type="file"
            accept=".json,application/json"
            className="field w-full text-xs"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />

          {error && <p role="alert" className="notice text-danger">{error}</p>}
          {success && <p role="status" className="notice text-green-600 dark:text-green-400">{success}</p>}

          {preview && (
            <div className="rounded-lg border border-line bg-surface2 p-3 text-xs text-text space-y-1">
              <p className="font-semibold text-sm">Export Preview</p>
              <p><strong>Conversations:</strong> {preview.summary.conversationsCount}</p>
              <p><strong>Total Messages:</strong> {preview.summary.messagesCount}</p>
              {preview.summary.oldestTimestamp && (
                <p>
                  <strong>Date Range:</strong> {new Date(preview.summary.oldestTimestamp).toLocaleDateString()}
                  {preview.summary.newestTimestamp && ` – ${new Date(preview.summary.newestTimestamp).toLocaleDateString()}`}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose} disabled={importing}>
            Cancel
          </button>
          {preview && (
            <button
              type="button"
              className="btn-primary"
              disabled={importing}
              onClick={handleCommit}
            >
              {importing ? 'Importing…' : `Import ${preview.summary.conversationsCount} Conversations`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
