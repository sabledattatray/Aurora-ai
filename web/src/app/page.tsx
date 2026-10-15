'use client';
import { useRouter } from 'next/navigation';
import { Welcome } from '@/components/chat/Welcome';
import { Composer } from '@/components/chat/Composer';
import { useApp } from '@/components/AppProvider';

export default function Home() {
  const { newChat, prefs, providerStatus, models, isGenerating, sendMessage, stopGeneration } = useApp();
  const router = useRouter();

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

  const handlePickOrSend = async (prompt: string): Promise<boolean> => {
    const c = await newChat();
    if (!c) return false;
    router.push(`/chat/?c=${c.id}`);
    if (modelReady) {
      return sendMessage(c.id, prompt);
    }
    return true;
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Welcome
          modelReady={modelReady}
          onPick={(prompt) => {
            void handlePickOrSend(prompt);
          }}
        />
        <div className="mx-auto max-w-3xl px-4">
          <button
            type="button"
            className="btn mt-2"
            onClick={async () => {
              const c = await newChat();
              if (c) router.push(`/chat/?c=${c.id}`);
            }}
          >
            Start a new chat
          </button>
        </div>
      </div>
      <Composer
        key="home"
        conversationId="home"
        disabledReason={disabledReason}
        generating={isGenerating}
        onSend={handlePickOrSend}
        onStop={stopGeneration}
      />
    </div>
  );
}
