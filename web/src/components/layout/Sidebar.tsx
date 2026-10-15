'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Conversation } from '@aurora/core';
import { useApp } from '@/components/AppProvider';
import { ConversationItem } from './ConversationItem';

export function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const { store, conversations, refresh, newChat } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const activeId = pathname.startsWith('/chat') ? params.get('c') : null;
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Conversation[] | null>(null);

  useEffect(() => {
    let live = true;
    if (!store || !q.trim()) return;
    const t = setTimeout(async () => {
      const r = await store.searchConversations(q);
      if (live) setResults(r);
    }, 150);
    return () => { live = false; clearTimeout(t); };
  }, [q, store, conversations]);

  const list = q.trim() ? (results ?? conversations) : conversations;

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 p-3">
        <button
          type="button" className="btn-primary w-full" disabled={!store}
          onClick={async () => { const c = await newChat(); if (c) { router.push(`/chat/?c=${c.id}`); onNavigate(); } }}
        >+ New chat</button>
        <div>
          <label htmlFor="search" className="sr-only">Search conversations</label>
          <input id="search" type="search" className="field" placeholder="Search conversations"
            value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <nav aria-label="Conversations" className="min-h-0 flex-1 overflow-y-auto px-2">
        {list.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted">
            {q.trim() ? 'No conversations match your search.' : 'No conversations yet. Start a new chat.'}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {list.map((c) => (
              <ConversationItem
                key={c.id} c={c} active={c.id === activeId} onNavigate={onNavigate}
                onRename={async (id, t) => { await store?.renameConversation(id, t); await refresh(); }}
                onDelete={async (id) => {
                  await store?.deleteConversation(id); await refresh();
                  if (id === activeId) router.push('/');
                }}
              />
            ))}
          </ul>
        )}
      </nav>
      <nav aria-label="Site" className="grid grid-cols-2 gap-1 border-t border-line p-2 text-sm">
        {[['/settings/', 'Settings'], ['/privacy/', 'Privacy'], ['/help/', 'Help'], ['/about/', 'About']].map(([href, label]) => (
          <Link key={href} href={href!} onClick={onNavigate}
            className="flex min-h-[44px] items-center rounded-lg px-3 hover:bg-surface2"
            aria-current={pathname === href || pathname === href!.slice(0, -1) ? 'page' : undefined}>{label}</Link>
        ))}
      </nav>
    </div>
  );
}
