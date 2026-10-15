'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DEFAULT_SYSTEM_PROMPT,
  SYSTEM_PROMPT_VERSION,
  validateLocalEndpoint,
  type PrivacyMode,
  type Theme,
} from '@aurora/core';
import { APP_NAME, APP_VERSION } from '@/lib/config';
import { useApp } from '@/components/AppProvider';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Page } from '@/components/shared/Page';
import { ImportModal } from './ImportModal';

const THEMES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function fmt(n: number) {
  return n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1e3)} KB`;
}

export function SettingsView() {
  const {
    prefs,
    setTheme,
    updatePreferences,
    store,
    refresh,
    providerStatus,
    models,
    refreshProvider,
    consents,
    revokeConsent,
    saveConsent,
  } = useApp();

  const [endpointInput, setEndpointInput] = useState(prefs.localEndpoint || 'http://127.0.0.1:11434');
  const [endpointError, setEndpointError] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [diagCopied, setDiagCopied] = useState(false);

  // Cloud / OpenAI-compatible provider state
  const [customEndpoint, setCustomEndpoint] = useState(prefs.customEndpoint || 'https://api.groq.com/openai/v1');
  const [apiKey, setApiKey] = useState(prefs.apiKey || '');
  const [cloudModel, setCloudModel] = useState(
    prefs.preferredModel && !prefs.preferredModel.startsWith('aurora') ? prefs.preferredModel : 'llama-3.3-70b-versatile'
  );
  const [showKey, setShowKey] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [cloudStatusMsg, setCloudStatusMsg] = useState<string | null>(null);

  const applyPreset = (name: 'groq' | 'openrouter' | 'openai' | 'lmstudio') => {
    if (name === 'groq') {
      setCustomEndpoint('https://api.groq.com/openai/v1');
      setCloudModel('llama-3.3-70b-versatile');
    } else if (name === 'openrouter') {
      setCustomEndpoint('https://openrouter.ai/api/v1');
      setCloudModel('meta-llama/llama-3.2-3b-instruct:free');
    } else if (name === 'openai') {
      setCustomEndpoint('https://api.openai.com/v1');
      setCloudModel('gpt-4o-mini');
    } else if (name === 'lmstudio') {
      setCustomEndpoint('http://127.0.0.1:1234/v1');
      setCloudModel('default');
    }
  };

  const handleSaveCloudProvider = async () => {
    setCloudSaving(true);
    setCloudStatusMsg(null);
    try {
      const isLoopback = customEndpoint.includes('127.0.0.1') || customEndpoint.includes('localhost');
      await updatePreferences({
        preferredProvider: 'openai-compatible',
        customEndpoint,
        apiKey,
        preferredModel: cloudModel,
        privacyMode: isLoopback ? prefs.privacyMode : 'ask-before-cloud',
      });
      if (!isLoopback) {
        await saveConsent({
          id: crypto.randomUUID(),
          purpose: 'cloud-text',
          scope: { providerId: 'openai-compatible' },
          choice: 'granted',
          timestamp: Date.now(),
          disclosureVersion: '1.0',
        });
      }
      await refreshProvider();
      setCloudStatusMsg('Saved and activated successfully!');
      setTimeout(() => setCloudStatusMsg(null), 3500);
    } catch {
      setCloudStatusMsg('Failed to save settings.');
    } finally {
      setCloudSaving(false);
    }
  };

  const [usage, setUsage] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const handleExport = async () => {
    if (!store) return;
    const data = await store.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aurora-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage !== undefined) setUsage(`${fmt(e.usage)} used by Aurora in this browser (estimate)`);
    }).catch(() => {});
  }, [cleared]);

  const handleSaveEndpoint = async () => {
    const v = validateLocalEndpoint(endpointInput);
    if (!v.ok) {
      setEndpointError(v.error);
      return;
    }
    setEndpointError(null);
    setTestingConnection(true);
    try {
      await updatePreferences({ localEndpoint: endpointInput });
      await refreshProvider();
    } finally {
      setTestingConnection(false);
    }
  };

  const copyDiagnostics = async () => {
    const diagInfo = {
      app: APP_NAME,
      version: APP_VERSION,
      endpoint: endpointInput,
      providerStatus: providerStatus.state,
      reasonCode: providerStatus.reasonCode,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      time: new Date().toISOString(),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(diagInfo, null, 2));
      setDiagCopied(true);
      setTimeout(() => setDiagCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <Page title="Settings">
      {/* 1. Appearance */}
      <section aria-labelledby="s-app" className="card">
        <h2 id="s-app" className="!mt-0">Appearance</h2>
        <fieldset className="mt-2">
          <legend className="sr-only">Theme</legend>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((t) => (
              <label
                key={t.value}
                className="btn cursor-pointer has-[:checked]:border-accent has-[:checked]:bg-surface2 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-accent"
              >
                <input
                  type="radio"
                  name="theme"
                  className="sr-only"
                  checked={prefs.theme === t.value}
                  onChange={() => void setTheme(t.value)}
                />
                {t.label}{prefs.theme === t.value ? ' ✓' : ''}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {/* 2. AI Providers */}
      <section aria-labelledby="s-ai" className="card">
        <h2 id="s-ai" className="!mt-0">AI Providers</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="provider-choice" className="block text-sm font-medium">Active AI Provider</label>
            <select
              id="provider-choice"
              className="field mt-1 w-full"
              value={prefs.preferredProvider ?? 'builtin'}
              onChange={async (e) => {
                const choice = e.target.value;
                if (choice === 'builtin') {
                  await updatePreferences({ preferredProvider: 'builtin', preferredModel: 'aurora-builtin' });
                } else if (choice === 'workers-ai') {
                  await updatePreferences({ preferredProvider: 'workers-ai', preferredModel: '@cf/meta/llama-3-8b-instruct' });
                } else if (choice === 'ollama') {
                  await updatePreferences({ preferredProvider: 'ollama' });
                } else if (choice === 'openai-compatible') {
                  await updatePreferences({
                    preferredProvider: 'openai-compatible',
                    customEndpoint,
                    apiKey,
                    preferredModel: cloudModel,
                  });
                }
                await refreshProvider();
              }}
            >
              <option value="builtin">Aurora Built-in Assistant (Offline, zero setup)</option>
              <option value="workers-ai">Hosted Aurora Gateway (Cloudflare Workers AI)</option>
              <option value="ollama">Ollama (Local on-device runtime)</option>
              <option value="openai-compatible">Cloud API / OpenAI-Compatible (Groq, OpenRouter, OpenAI, LM Studio)</option>
            </select>
          </div>

          {/* Hosted Cloudflare Workers AI Gateway Info */}
          {prefs.preferredProvider === 'workers-ai' && (
            <div className="rounded-lg border border-line bg-surface p-3 text-sm space-y-3">
              <div className="flex items-center justify-between">
                <span>Hosted Gateway Status:</span>
                <span className={`font-semibold ${providerStatus.state === 'reachable' ? 'text-green-600 dark:text-green-400' : 'text-danger'}`}>
                  {providerStatus.state === 'reachable' ? '● Connected' : '○ Unavailable / Standalone'}
                </span>
              </div>
              <p className="text-xs text-muted">
                Free hosted inference powered by Cloudflare Workers AI. Requests are proxied through Aurora&apos;s privacy gateway with hashed client IPs, zero retention, and no prompt logging.
              </p>
              {models.length > 0 && (
                <div>
                  <label htmlFor="hosted-model-select" className="block text-xs font-medium">Active Cloud Model</label>
                  <select
                    id="hosted-model-select"
                    className="field mt-1 w-full text-xs"
                    value={prefs.preferredModel ?? ''}
                    onChange={(e) => void updatePreferences({ preferredModel: e.target.value })}
                  >
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Built-in Provider Info */}
          {(prefs.preferredProvider === 'builtin' || (!prefs.preferredProvider && providerStatus.state === 'reachable' && prefs.preferredModel === 'aurora-builtin')) && (
            <div className="rounded-lg border border-line bg-surface p-3 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">● Ready (In-Browser)</span>
              </div>
              <p className="text-xs text-muted">
                The built-in assistant runs 100% on-device in your browser with zero external network access. It is ready for chatting, writing, coding assistance, and testing right out of the box.
              </p>
            </div>
          )}

          {/* Ollama Provider Section */}
          <div className="border-t border-line pt-3">
            <h3 className="text-base font-medium">Local Model (Ollama)</h3>
            <p className="text-sm text-muted">
              Connect to your local Ollama runtime to run larger open-weights models (e.g. Llama 3, Mistral, Qwen).
            </p>

            <div className="mt-3">
              <label htmlFor="endpoint" className="block text-sm font-medium">Ollama Endpoint URL</label>
              <div className="mt-1 flex gap-2">
                <input
                  id="endpoint"
                  type="url"
                  className="field flex-1"
                  value={endpointInput}
                  onChange={(e) => {
                    setEndpointInput(e.target.value);
                    setEndpointError(null);
                  }}
                  placeholder="http://127.0.0.1:11434"
                />
                <button
                  type="button"
                  className="btn-primary"
                  disabled={testingConnection}
                  onClick={async () => {
                    await updatePreferences({ preferredProvider: 'ollama' });
                    await handleSaveEndpoint();
                  }}
                >
                  {testingConnection ? 'Testing…' : 'Test & Save'}
                </button>
              </div>
              {endpointError && <p role="alert" className="mt-1 text-xs text-danger">{endpointError}</p>}
            </div>

            {/* Status Display */}
            <div className="mt-3 rounded-lg border border-line bg-surface p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Ollama Status:</span>
                <span className={`font-semibold ${providerStatus.state === 'reachable' && prefs.preferredProvider === 'ollama' ? 'text-green-600 dark:text-green-400' : 'text-danger'}`}>
                  {providerStatus.state === 'reachable' && prefs.preferredProvider === 'ollama' ? '● Connected' : '○ Not Reachable'}
                </span>
              </div>

              {providerStatus.state === 'reachable' && prefs.preferredProvider === 'ollama' && (
                <div className="mt-3">
                  <label htmlFor="model-select" className="block text-xs font-medium">Active Model</label>
                  {models.length > 0 ? (
                    <select
                      id="model-select"
                      className="field mt-1 w-full"
                      value={prefs.preferredModel ?? ''}
                      onChange={(e) => {
                        void updatePreferences({ preferredModel: e.target.value });
                      }}
                    >
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.sizeBytes ? `(${(m.sizeBytes / 1e9).toFixed(1)} GB)` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="mt-1 text-xs text-muted">
                      No models installed in Ollama. Pull a model using: <code className="rounded bg-surface2 px-1">ollama pull llama3</code>
                    </p>
                  )}
                </div>
              )}

              {/* Diagnostic Panel for Unreachable State */}
              {prefs.preferredProvider === 'ollama' && providerStatus.state !== 'reachable' && (
                <div className="mt-3 space-y-2 border-t border-line pt-3 text-xs">
                  <p className="font-semibold text-danger">Ollama is not running or unreachable:</p>
                  <ol className="list-decimal space-y-1 pl-4 text-muted">
                    <li><strong>Launch Ollama:</strong> Make sure Ollama is installed and running on your computer.</li>
                    <li><strong>Quick Setup:</strong> In terminal, run <code className="rounded bg-surface2 px-1">ollama run llama3.2:1b</code>.</li>
                    <li><strong>Browser permission:</strong> If prompted by the browser, allow access to local network / loopback.</li>
                  </ol>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      onClick={async () => {
                        await updatePreferences({ preferredProvider: 'builtin', preferredModel: 'aurora-builtin' });
                        await refreshProvider();
                      }}
                    >
                      Use Built-in Assistant instead
                    </button>
                    <button type="button" className="btn text-xs" onClick={copyDiagnostics}>
                      {diagCopied ? 'Copied to clipboard!' : 'Copy diagnostic info'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cloud API / OpenAI-Compatible Provider Section */}
          <div className="border-t border-line pt-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-medium">Cloud API / OpenAI-Compatible Endpoint</h3>
                <p className="text-sm text-muted">
                  Connect frontier models (Groq Llama 3.3, OpenRouter, OpenAI GPT-4o, or local LM Studio).
                </p>
              </div>
              {prefs.preferredProvider === 'openai-compatible' && (
                <span className="font-semibold text-xs text-green-600 dark:text-green-400">● Active</span>
              )}
            </div>

            {/* Quick Presets */}
            <div className="mt-3">
              <span className="block text-xs font-medium text-muted">Quick Presets:</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button type="button" className="btn text-xs" onClick={() => applyPreset('groq')}>⚡ Groq (Free Llama 3.3)</button>
                <button type="button" className="btn text-xs" onClick={() => applyPreset('openrouter')}>🌐 OpenRouter (Free Models)</button>
                <button type="button" className="btn text-xs" onClick={() => applyPreset('openai')}>🤖 OpenAI (GPT-4o-mini)</button>
                <button type="button" className="btn text-xs" onClick={() => applyPreset('lmstudio')}>💻 LM Studio (Local)</button>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="cloud-endpoint" className="block text-xs font-medium">API Endpoint URL</label>
                <input
                  id="cloud-endpoint"
                  type="url"
                  className="field mt-1 text-sm"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                  placeholder="https://api.groq.com/openai/v1"
                />
              </div>

              <div>
                <label htmlFor="cloud-key" className="block text-xs font-medium">
                  API Key <span className="text-muted">(saved locally in browser storage)</span>
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="cloud-key"
                    type={showKey ? 'text' : 'password'}
                    className="field flex-1 text-sm"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="gsk_... or sk-..."
                  />
                  <button type="button" className="btn text-xs" onClick={() => setShowKey(!showKey)}>
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Need a free key? Get a free API key at{' '}
                  <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="underline text-accent">
                    console.groq.com
                  </a>{' '}
                  (takes 20 seconds, zero cost).
                </p>
              </div>

              <div>
                <label htmlFor="cloud-model" className="block text-xs font-medium">Model ID</label>
                <input
                  id="cloud-model"
                  type="text"
                  className="field mt-1 text-sm"
                  value={cloudModel}
                  onChange={(e) => setCloudModel(e.target.value)}
                  placeholder="llama-3.3-70b-versatile"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={cloudSaving}
                  onClick={handleSaveCloudProvider}
                >
                  {cloudSaving ? 'Saving…' : 'Save & Activate Cloud Model'}
                </button>
                {cloudStatusMsg && (
                  <span role="status" className="text-xs font-medium text-green-600 dark:text-green-400">
                    {cloudStatusMsg}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Privacy & Consent (PRD Section 8) */}
      <section aria-labelledby="s-priv" className="card">
        <h2 id="s-priv" className="!mt-0">Privacy</h2>
        <fieldset className="mt-2">
          <legend className="text-sm font-medium">Privacy Mode</legend>
          <div className="mt-2 space-y-2">
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="privacyMode"
                value="local-only"
                checked={prefs.privacyMode === 'local-only'}
                onChange={() => void updatePreferences({ privacyMode: 'local-only' })}
              />
              <span>
                <strong>Local-only (Default)</strong>: All processing stays strictly on your device. Zero external network transmission to any cloud provider or gateway.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="privacyMode"
                value="ask-before-cloud"
                checked={prefs.privacyMode === 'ask-before-cloud'}
                onChange={() => void updatePreferences({ privacyMode: 'ask-before-cloud' })}
              />
              <span>
                <strong>Ask-before-cloud</strong>: Allows optional online models. Before any data leaves your browser, a clear disclosure shows what will be sent and requires your consent.
              </span>
            </label>
          </div>
        </fieldset>

        {consents.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <h3 className="text-sm font-medium">Granted Consents</h3>
            <ul className="mt-2 space-y-2 text-xs">
              {consents.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded border border-line p-2">
                  <span>
                    Provider: <strong>{c.scope.providerId}</strong> ({c.purpose}) ·{' '}
                    {c.revokedAt ? <span className="text-danger">Revoked</span> : <span className="text-green-600">Active</span>}
                  </span>
                  {!c.revokedAt && (
                    <button type="button" className="btn text-xs" onClick={() => void revokeConsent(c.id)}>
                      Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4">
          <Link href="/privacy/" className="text-sm underline">View detailed privacy data flows</Link>
        </div>
      </section>

      {/* 4. System Prompt Transparency (PRD 7.10) */}
      <section aria-labelledby="s-prompt" className="card">
        <h2 id="s-prompt" className="!mt-0">System Instructions</h2>
        <p className="text-sm text-muted">
          Aurora uses a transparent system instruction set to ensure safe, honest responses.
        </p>
        <button
          type="button"
          className="btn mt-2 text-xs"
          onClick={() => setShowSystemPrompt((s) => !s)}
        >
          {showSystemPrompt ? 'Hide System Prompt' : 'View System Prompt (v' + SYSTEM_PROMPT_VERSION + ')'}
        </button>
        {showSystemPrompt && (
          <pre className="mt-3 overflow-x-auto rounded bg-surface2 p-3 text-xs leading-relaxed">
            {DEFAULT_SYSTEM_PROMPT}
          </pre>
        )}
      </section>

      {/* 5. Storage */}
      <section aria-labelledby="s-store" className="card">
        <h2 id="s-store" className="!mt-0">Storage</h2>
        <p className="text-sm text-muted">
          Conversations are stored in this browser only. Browser storage is not encrypted; anyone with access to this device profile may be able to read it.
        </p>
        {usage && <p className="mt-2 text-sm">{usage}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={!store}
            onClick={handleExport}
          >
            Export all data (JSON)
          </button>
          <button
            type="button"
            className="btn"
            disabled={!store}
            onClick={() => setImportOpen(true)}
          >
            Import conversations…
          </button>
          <button
            type="button"
            className="btn"
            onClick={async () => {
              try {
                const ok = await navigator.storage?.persist?.();
                setPersisted(
                  ok
                    ? 'Your browser agreed to keep Aurora’s data. It can still be removed if you clear site data.'
                    : 'Your browser did not guarantee persistence. Export important chats regularly.'
                );
              } catch {
                setPersisted('Persistence is not supported in this browser.');
              }
            }}
          >
            Ask browser to keep my data
          </button>
          <button type="button" className="btn-danger" disabled={!store} onClick={() => setConfirm(true)}>
            Delete all data…
          </button>
        </div>
        <p role="status" className="mt-2 text-sm">{persisted}{cleared ? ' All data deleted.' : ''}</p>
      </section>

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />

      {/* 6. About */}
      <section aria-labelledby="s-about" className="card">
        <h2 id="s-about" className="!mt-0">About</h2>
        <p>{APP_NAME} version {APP_VERSION}. <Link href="/about/">Limitations and licences</Link></p>
      </section>

      <ConfirmDialog
        open={confirm}
        title="Delete all Aurora data?"
        confirmLabel="Delete everything"
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false);
          await store?.clearAll();
          await refresh();
          setCleared(true);
        }}
      >
        This permanently deletes every conversation, consent record, and setting stored in this browser. This cannot be undone.
      </ConfirmDialog>
    </Page>
  );
}
