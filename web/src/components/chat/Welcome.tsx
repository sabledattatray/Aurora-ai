'use client';
import Link from 'next/link';
import { APP_NAME } from '@/lib/config';

const CARDS = [
  { title: 'Explain a topic', prompt: 'Explain how photosynthesis works in simple terms.' },
  { title: 'Draft or improve writing', prompt: 'Help me improve this paragraph: ' },
  { title: 'Help with code', prompt: 'Explain what this code does: ' },
];

export function Welcome({ modelReady, onPick }: { modelReady: boolean; onPick: (prompt: string) => void }) {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-8" aria-labelledby="welcome-h">
      <h1 id="welcome-h" className="text-2xl font-semibold">Welcome to {APP_NAME}</h1>
      <p className="mt-2 text-muted">
        A private assistant that keeps your conversations in this browser. No account needed.
      </p>
      {!modelReady && (
        <div className="card mt-5">
          <h2 className="font-semibold">Set up a model to start chatting</h2>
          <p className="mt-1 text-sm text-muted">
            Aurora needs an AI model to answer. It will never make up a reply. You can connect a local Ollama model, use the offline built-in assistant, or configure optional hosted inference in Settings.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/settings/" className="btn-primary">Open settings</Link>
            <Link href="/help/" className="btn">Local setup guide</Link>
            <Link href="/privacy/" className="btn">How your data is handled</Link>
          </div>
        </div>
      )}
      <h2 className="mt-8 text-sm font-medium text-muted">Things you can ask</h2>
      <ul className="mt-2 grid gap-3 sm:grid-cols-3">
        {CARDS.map((c) => (
          <li key={c.title}>
            <button type="button" className="card h-full w-full text-left disabled:opacity-60"
              disabled={!modelReady} onClick={() => onPick(c.prompt)}>
              <span className="font-medium">{c.title}</span>
              <span className="mt-1 block text-sm text-muted">{c.prompt.trim()}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
