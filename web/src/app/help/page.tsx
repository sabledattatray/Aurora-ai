import type { Metadata } from 'next';
import { Page } from '@/components/shared/Page';

export const metadata: Metadata = { title: 'Help & Setup - Aurora AI' };

export default function HelpPage() {
  return (
    <Page title="Help and Setup">
      <section className="space-y-4">
        <p>
          Aurora AI connects directly to an AI model running locally on your computer using{' '}
          <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="underline">Ollama</a>.
          Your prompts and messages stay on your device and are never sent to any remote server.
        </p>

        <h2>Step-by-Step Local Setup</h2>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong>Install Ollama</strong>: Download and install Ollama from{' '}
            <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="underline">ollama.com</a> for
            Windows, macOS, or Linux.
          </li>
          <li>
            <strong>Download a model</strong>: Open your terminal and run:
            <pre className="mt-1 overflow-x-auto rounded bg-surface2 p-2 text-xs">ollama pull llama3</pre>
            <span className="text-xs text-muted">
              Models are large (several GB). Small models (e.g. 1B-4B parameters) require ~3-4 GB RAM; 7B-8B models typically need 8 GB+ RAM.
            </span>
          </li>
          <li>
            <strong>Allow browser connections (CORS)</strong>:
            <p className="mt-1 text-sm text-muted">
              Because Aurora runs in your web browser, Ollama must allow browser origins to access port 11434:
            </p>
            <div className="mt-2 space-y-2 text-xs">
              <div className="rounded bg-surface2 p-2">
                <strong>Windows:</strong>
                <p>Quit Ollama from the system tray. In PowerShell or Command Prompt, run:</p>
                <code>setx OLLAMA_ORIGINS &quot;*&quot;</code>
                <p className="mt-1">Then restart Ollama from your Start menu.</p>
              </div>
              <div className="rounded bg-surface2 p-2">
                <strong>macOS:</strong>
                <p>In Terminal, run:</p>
                <code>launchctl setenv OLLAMA_ORIGINS &quot;*&quot;</code>
                <p className="mt-1">Then quit and reopen the Ollama application.</p>
              </div>
              <div className="rounded bg-surface2 p-2">
                <strong>Linux (systemd):</strong>
                <p>Edit the service with <code>sudo systemctl edit ollama.service</code>, add:</p>
                <code>[Service]
Environment=&quot;OLLAMA_ORIGINS=*&quot;</code>
                <p className="mt-1">Save and run <code>sudo systemctl restart ollama</code>.</p>
              </div>
            </div>
          </li>
          <li>
            <strong>Connect in Aurora</strong>: Go to{' '}
            <a href="/settings/" className="underline">Settings</a>, click <strong>Test & Save</strong>, and pick your model from the list.
          </li>
        </ol>

        <h2>Device & Browser Notes</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li><strong>Phones & Tablets:</strong> Mobile devices generally cannot run Ollama directly.</li>
          <li><strong>Browser Security:</strong> Chromium browsers may show a prompt to allow access to local network resources. Always accept to allow connection to loopback (127.0.0.1).</li>
          <li><strong>Never turn off browser security:</strong> Aurora is designed to work with loopback without disabling security protections.</li>
        </ul>

        <h2>Troubleshooting</h2>
        <div className="space-y-2 text-sm">
          <p><strong>Status says &quot;Not Reachable&quot;:</strong></p>
          <ul className="list-disc pl-5 text-muted text-xs space-y-1">
            <li>Ensure Ollama is running (check task manager or tray).</li>
            <li>Confirm `OLLAMA_ORIGINS` was configured and Ollama was restarted.</li>
            <li>Test `http://127.0.0.1:11434` in a new browser tab; you should see &quot;Ollama is running&quot;.</li>
          </ul>

          <p className="pt-2"><strong>History Missing:</strong></p>
          <p className="text-xs text-muted">
            Conversations live in your browser&apos;s IndexedDB. Clearing browser site data or using Private/Incognito browsing will not retain past history. Regular exports are recommended.
          </p>
        </div>
      </section>
    </Page>
  );
}
