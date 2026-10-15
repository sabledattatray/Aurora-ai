import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ChatView } from '@/components/chat/ChatView';

export const metadata: Metadata = { title: 'Chat' };

export default function ChatPage() {
  return <Suspense fallback={<p className="p-6 text-muted">Loading…</p>}><ChatView /></Suspense>;
}
