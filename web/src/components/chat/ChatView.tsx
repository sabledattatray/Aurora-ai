'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { isConsentValid, type Conversation, type Message } from '@aurora/core';
import { useApp } from '@/components/AppProvider';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { Welcome } from './Welcome';
import { ConsentDialog } from './ConsentDialog';

export function ChatView() {
  const {
    store,
    ready,
    conversations,
    prefs,
    provider,
    providerStatus,
    models,
    consents,
    isGenerating,
    contextNotice,
    sendMessage,
    retryMessage,
    stopGeneration,
    saveConsent,
  } = useApp();

  const id = useSearchParams().get('c');
  const [conv, setConv] = useState<Conversation | null | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingConsent, setPendingConsent] = useState<{ text: string; resolve: (accepted: boolean) => void } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      if (!ready) return;
      if (!store || !id) { setConv(null); return; }
      const c = await store.getConversation(id);
      const m = c ? await store.listMessages(id) : [];
      if (live) { setConv(c ?? null); setMessages(m); }
    })();
    return () => { live = false; };
  }, [store, ready, id, conversations, isGenerating]);

  const lastMessageContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, lastMessageContent]);

  const modelReady = Boolean(prefs.preferredModel && providerStatus.state === 'reachable');

  const disabledReason = (() => {
    if (!prefs.preferredModel) {
      return models.length > 0
        ? 'Select a model in Settings to start chatting.'
        : 'No AI model is set up yet. Make sure Ollama is running and select a model in Settings.';
    }
    if (providerStatus.state === 'unavailable') {
      return `Aurora can't reach your local model at ${prefs.localEndpoint || 'http://127.0.0.1:11434'}. Make sure Ollama is running.`;
    }
    return undefined;
  })();

  if (conv === undefined) return <p className="p-6 text-muted" role="status">Loading…</p>;
  if (!conv) {
    return (
      <section className="mx-auto max-w-xl p-6">
        <h1 className="text-xl font-semibold">Conversation not found</h1>
        <p className="mt-2 text-muted">It may have been deleted, or it was saved in a different browser.</p>
        <Link href="/" className="btn-primary mt-4">Go to start</Link>
      </section>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <h1 className="sr-only">{conv.title}</h1>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {contextNotice && (
          <div role="note" className="notice mx-auto mt-2 max-w-3xl">
            {contextNotice}
          </div>
        )}
        {messages.length === 0 ? (
          <Welcome
            modelReady={modelReady}
            onPick={async (prompt) => {
              if (modelReady) {
                await sendMessage(conv.id, prompt);
              }
            }}
          />
        ) : (
          <MessageList
            messages={messages}
            onRetry={async (m) => {
              const history = (await store?.listMessages(conv.id)) ?? [];
              const idx = history.findIndex((msg) => msg.id === m.id);
              const userPrompt = idx > 0 ? history[idx - 1] : null;
              const promptText = userPrompt?.role === 'user' ? userPrompt.content : '';

              if (prefs.privacyMode === 'ask-before-cloud' && provider.route === 'cloud') {
                const hasConsent = consents.some(
                  (c) => isConsentValid(c, 'cloud-text', conv.id) && c.scope.providerId === provider.id
                );
                if (!hasConsent && promptText) {
                  setPendingConsent({
                    text: promptText,
                    resolve: async (accepted) => {
                      if (accepted) {
                        await retryMessage(conv.id, m);
                      }
                    },
                  });
                  return;
                }
              }
              await retryMessage(conv.id, m);
            }}
          />
        )}
        <div ref={bottom} />
      </div>
      <Composer
        key={conv.id}
        conversationId={conv.id}
        disabledReason={disabledReason}
        generating={isGenerating}
        onSend={async (text) => {
          if (prefs.privacyMode === 'ask-before-cloud' && provider.route === 'cloud') {
            const hasConsent = consents.some(
              (c) => isConsentValid(c, 'cloud-text', conv.id) && c.scope.providerId === provider.id
            );
            if (!hasConsent) {
              return new Promise<boolean>((resolve) => {
                setPendingConsent({ text, resolve });
              });
            }
          }
          return sendMessage(conv.id, text);
        }}
        onStop={stopGeneration}
      />

      {pendingConsent && (
        <ConsentDialog
          open={Boolean(pendingConsent)}
          providerId={provider.id}
          providerName={provider.name}
          providerCompany={provider.id === 'workers-ai' ? 'Cloudflare, Inc.' : 'API Provider'}
          providerTermsUrl={
            provider.id === 'workers-ai'
              ? 'https://www.cloudflare.com/privacypolicy/'
              : 'https://openai.com/policies/privacy-policy/'
          }
          conversationId={conv.id}
          previewText={pendingConsent.text}
          onGrant={async (record) => {
            await saveConsent(record);
            const sent = await sendMessage(conv.id, pendingConsent.text);
            pendingConsent.resolve(sent);
            setPendingConsent(null);
          }}
          onDeny={() => {
            pendingConsent.resolve(false);
            setPendingConsent(null);
          }}
        />
      )}
    </div>
  );
}
