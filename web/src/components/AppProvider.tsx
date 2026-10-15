'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_PREFERENCES,
  DEFAULT_SYSTEM_PROMPT,
  buildContextWindow,
  routeRequest,
  type ConsentRecord,
  type Conversation,
  type Message,
  type ModelInfo,
  type Preferences,
  type ProviderStatus,
  type Theme,
} from '@aurora/core';
import { createStore, type AuroraStore } from '@/lib/storage/store';
import { StorageError } from '@/lib/storage/db';
import { OllamaProvider } from '@/lib/providers/ollama';
import { BuiltinProvider } from '@/lib/providers/builtin';
import { OpenAICompatibleProvider } from '@/lib/providers/openai';
import { HostedWorkersAIProvider } from '@/lib/providers/hosted';
import type { Provider } from '@aurora/core';

interface Ctx {
  ready: boolean;
  store: AuroraStore | null;
  storageError: StorageError['code'] | null;
  prefs: Preferences;
  setTheme: (t: Theme) => Promise<void>;
  updatePreferences: (patch: Partial<Preferences>) => Promise<Preferences>;
  conversations: Conversation[];
  refresh: () => Promise<void>;
  newChat: () => Promise<Conversation | null>;
  reloadRequired: boolean;

  // Provider & Generation
  provider: Provider;
  providerStatus: ProviderStatus;
  models: ModelInfo[];
  refreshProvider: () => Promise<void>;

  // Consents
  consents: ConsentRecord[];
  saveConsent: (consent: ConsentRecord) => Promise<void>;
  revokeConsent: (id: string) => Promise<void>;

  // Chat Execution
  isGenerating: boolean;
  activeGeneratingId: string | null;
  contextNotice: string | null;
  sendMessage: (conversationId: string, text: string) => Promise<boolean>;
  retryMessage: (conversationId: string, message: Message) => Promise<boolean>;
  stopGeneration: () => void;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
};

function applyTheme(t: Theme) {
  const el = document.documentElement;
  if (t === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', t);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<AuroraStore | null>(null);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<Ctx['storageError']>(null);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [reloadRequired, setReloadRequired] = useState(false);

  // Local Provider state
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>({ state: 'unknown' });
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeGeneratingId, setActiveGeneratingId] = useState<string | null>(null);
  const [contextNotice, setContextNotice] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const builtinProvider = useMemo(() => new BuiltinProvider(), []);

  const ollamaProvider = useMemo(() => {
    return new OllamaProvider({
      endpoint: prefs.localEndpoint ?? DEFAULT_PREFERENCES.localEndpoint,
      privacyMode: prefs.privacyMode,
    });
  }, [prefs.localEndpoint, prefs.privacyMode]);

  const openaiProvider = useMemo(() => {
    return new OpenAICompatibleProvider({
      endpoint: prefs.customEndpoint ?? 'https://api.groq.com/openai/v1',
      apiKey: prefs.apiKey,
      modelId: prefs.preferredModel,
      privacyMode: prefs.privacyMode,
    });
  }, [prefs.customEndpoint, prefs.apiKey, prefs.preferredModel, prefs.privacyMode]);

  const hostedProvider = useMemo(() => {
    return new HostedWorkersAIProvider({
      gatewayUrl: '/api',
      privacyMode: prefs.privacyMode,
    });
  }, [prefs.privacyMode]);

  const provider = useMemo<Provider>(() => {
    if (prefs.preferredProvider === 'openai-compatible') {
      return openaiProvider;
    }
    if (prefs.preferredProvider === 'workers-ai') {
      return hostedProvider;
    }
    if (prefs.preferredProvider === 'ollama') {
      return ollamaProvider;
    }
    if (prefs.preferredProvider === 'builtin') {
      return builtinProvider;
    }
    // Auto fallback: if ollama is reachable, use ollama, else builtin
    return providerStatus.state === 'reachable' && models.some((m) => m.id !== 'aurora-builtin')
      ? ollamaProvider
      : builtinProvider;
  }, [prefs.preferredProvider, providerStatus.state, models, ollamaProvider, builtinProvider, openaiProvider, hostedProvider]);

  const refreshProvider = useCallback(async () => {
    if (!store) return;
    try {
      if (prefs.preferredProvider === 'openai-compatible') {
        const status = await openaiProvider.getStatus();
        setProviderStatus(status);
        if (status.state === 'reachable') {
          const list = await openaiProvider.listModels();
          if (list.length > 0) {
            setModels(list);
            if (!prefs.preferredModel) {
              const updated = await store.setPreferences({ preferredModel: list[0]!.id });
              setPrefs(updated);
            }
          } else if (prefs.preferredModel) {
            setModels([{ id: prefs.preferredModel, name: prefs.preferredModel, contextLength: 8192 }]);
          }
        }
        return;
      }

      if (prefs.preferredProvider === 'workers-ai') {
        const status = await hostedProvider.getStatus();
        setProviderStatus(status);
        const list = await hostedProvider.listModels();
        setModels(list);
        if (!prefs.preferredModel || !list.some((m) => m.id === prefs.preferredModel)) {
          if (list[0]) {
            const updated = await store.setPreferences({ preferredModel: list[0].id });
            setPrefs(updated);
          }
        }
        return;
      }

      if (prefs.preferredProvider === 'builtin') {
        const status = await builtinProvider.getStatus();
        const list = await builtinProvider.listModels();
        setProviderStatus(status);
        setModels(list);
        if (prefs.preferredModel !== 'aurora-builtin') {
          const updated = await store.setPreferences({ preferredModel: 'aurora-builtin' });
          setPrefs(updated);
        }
        return;
      }

      const ollamaStatus = await ollamaProvider.getStatus();
      if (ollamaStatus.state === 'reachable') {
        const list = await ollamaProvider.listModels();
        if (list.length > 0) {
          setProviderStatus(ollamaStatus);
          setModels(list);
          const active = list.find((m) => m.id === prefs.preferredModel) ?? list[0]!;
          if (prefs.preferredModel !== active.id) {
            const updated = await store.setPreferences({
              preferredProvider: 'ollama',
              preferredModel: active.id,
            });
            setPrefs(updated);
          }
          return;
        }
      }

      if (prefs.preferredProvider === 'ollama') {
        setProviderStatus(ollamaStatus);
        setModels([]);
        return;
      }

      // Default zero-setup fallback: Built-in Assistant
      const status = await builtinProvider.getStatus();
      const list = await builtinProvider.listModels();
      setProviderStatus(status);
      setModels(list);
      if (prefs.preferredModel !== 'aurora-builtin') {
        const updated = await store.setPreferences({
          preferredProvider: 'builtin',
          preferredModel: 'aurora-builtin',
        });
        setPrefs(updated);
      }
    } catch {
      const list = await builtinProvider.listModels();
      setProviderStatus({ state: 'reachable' });
      setModels(list);
    }
  }, [builtinProvider, ollamaProvider, openaiProvider, hostedProvider, prefs.preferredProvider, prefs.preferredModel, store]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await createStore('aurora', () => setReloadRequired(true));
        const [p, c, userConsents] = await Promise.all([
          s.getPreferences(),
          s.listConversations(),
          s.listConsents(),
        ]);
        if (cancelled) return;
        setStore(s);
        setPrefs(p);
        setConversations(c);
        setConsents(userConsents);

        // Initial provider check
        try {
          if (p.preferredProvider === 'workers-ai') {
            const prov = new HostedWorkersAIProvider({
              gatewayUrl: '/api',
              privacyMode: p.privacyMode,
            });
            const st = await prov.getStatus();
            const list = await prov.listModels();
            if (!cancelled) {
              setProviderStatus(st);
              setModels(list);
              if (!p.preferredModel && list[0]) {
                const updated = await s.setPreferences({
                  preferredProvider: 'workers-ai',
                  preferredModel: list[0].id,
                });
                setPrefs(updated);
              }
            }
          } else if (p.preferredProvider === 'builtin') {
            const list = await builtinProvider.listModels();
            if (!cancelled) {
              setProviderStatus({ state: 'reachable' });
              setModels(list);
            }
          } else {
            const prov = new OllamaProvider({
              endpoint: p.localEndpoint ?? DEFAULT_PREFERENCES.localEndpoint,
              privacyMode: p.privacyMode,
            });
            const st = await prov.getStatus();
            if (st.state === 'reachable') {
              const list = await prov.listModels();
              if (!cancelled) {
                setProviderStatus(st);
                setModels(list);
                const first = list[0];
                if (!p.preferredModel && first) {
                  const updated = await s.setPreferences({
                    preferredProvider: 'ollama',
                    preferredModel: first.id,
                  });
                  setPrefs(updated);
                }
              }
            } else if (p.preferredProvider === 'ollama') {
              if (!cancelled) {
                setProviderStatus(st);
                setModels([]);
              }
            } else {
              // Default to Builtin Assistant
              const list = await builtinProvider.listModels();
              if (!cancelled) {
                setProviderStatus({ state: 'reachable' });
                setModels(list);
                if (p.preferredModel !== 'aurora-builtin') {
                  const updated = await s.setPreferences({
                    preferredProvider: 'builtin',
                    preferredModel: 'aurora-builtin',
                  });
                  setPrefs(updated);
                }
              }
            }
          }
        } catch {
          if (!cancelled) {
            const list = await builtinProvider.listModels();
            setProviderStatus({ state: 'reachable' });
            setModels(list);
          }
        }
      } catch (e) {
        if (!cancelled) setStorageError(e instanceof StorageError ? e.code : 'STORAGE_UNAVAILABLE');
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [builtinProvider]);

  const refresh = useCallback(async () => {
    if (store) {
      const [c, userConsents] = await Promise.all([
        store.listConversations(),
        store.listConsents(),
      ]);
      setConversations(c);
      setConsents(userConsents);
    }
  }, [store]);

  const setTheme = useCallback(async (t: Theme) => {
    applyTheme(t);
    setPrefs((p) => ({ ...p, theme: t }));
    if (store) setPrefs(await store.setPreferences({ theme: t }));
  }, [store]);

  const updatePreferences = useCallback(async (patch: Partial<Preferences>) => {
    if (!store) return prefs;
    const next = await store.setPreferences(patch);
    setPrefs(next);
    if (patch.theme) applyTheme(patch.theme);
    return next;
  }, [store, prefs]);

  const saveConsent = useCallback(async (consent: ConsentRecord) => {
    if (!store) return;
    await store.saveConsent(consent);
    await refresh();
  }, [store, refresh]);

  const revokeConsent = useCallback(async (id: string) => {
    if (!store) return;
    await store.revokeConsent(id);
    await refresh();
  }, [store, refresh]);

  const newChat = useCallback(async () => {
    if (!store) return null;
    for (const c of conversations) {
      if (c.title === 'New chat' && (await store.listMessages(c.id)).length === 0) return c;
    }
    const c = await store.createConversation();
    await refresh();
    return c;
  }, [store, conversations, refresh]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setActiveGeneratingId(null);
  }, []);

  const sendMessage = useCallback(
    async (conversationId: string, text: string): Promise<boolean> => {
      if (!store || isGenerating) return false;

      // 1. Router verification (PRD Section 8)
      const targetModel = prefs.preferredModel || (models[0]?.id ?? 'aurora-builtin');
      const targetProvider = provider.id;
      const targetRoute = provider.route;
      const decision = routeRequest({
        privacyMode: prefs.privacyMode,
        target: {
          route: targetRoute,
          providerId: targetProvider,
          modelId: targetModel,
        },
        conversationId,
        consents,
      });

      // 2. Add user message
      await store.addMessage({
        conversationId,
        role: 'user',
        content: text,
        status: 'complete',
      });
      await refresh();

      if (!decision.allowed) {
        // Record failed assistant response with plain reason
        await store.addMessage({
          conversationId,
          role: 'assistant',
          content: '',
          status: 'failed',
          errorCode: decision.code,
        });
        await refresh();
        return true; // user draft is cleared since the request was handled
      }

      // 3. Build context window (PRD 7.8, AC-19)
      const history = await store.listMessages(conversationId);
      const caps = targetModel ? await provider.getCapabilities(targetModel) : { maxContextTokens: 4096 };
      const contextBudget = prefs.contextWindowTokens ?? caps.maxContextTokens ?? 4096;

      const contextRes = buildContextWindow(
        history.map((m) => ({ role: m.role, content: m.content })),
        {
          modelContextTokens: contextBudget,
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
        }
      );

      if (!contextRes.ok) {
        await store.addMessage({
          conversationId,
          role: 'assistant',
          content: '',
          status: 'failed',
          errorCode: contextRes.error,
        });
        await refresh();
        return true;
      }

      setContextNotice(contextRes.context.notice ?? null);

      // 4. Create pending assistant message
      const assistantMsg = await store.addMessage({
        conversationId,
        role: 'assistant',
        content: '',
        status: 'pending',
        providerId: targetProvider,
        modelId: targetModel,
        route: targetRoute,
      });
      await refresh();

      // 5. Begin streaming
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsGenerating(true);
      setActiveGeneratingId(assistantMsg.id);

      let accumulatedContent = '';
      let chunkCounter = 0;
      let lastSaveTime = Date.now();

      const announce = (text: string) => {
        const el = document.getElementById('status-region');
        if (el) el.textContent = text;
      };

      announce('Response started');

      try {
        await store.updateMessage(assistantMsg.id, { status: 'streaming' });

        if (decision.allowed && decision.consentRecord && typeof (provider as unknown as { setConsent?: (c?: ConsentRecord) => void }).setConsent === 'function') {
          (provider as unknown as { setConsent: (c?: ConsentRecord) => void }).setConsent(decision.consentRecord);
        }

        const stream = provider.generateStream(
          {
            requestId: crypto.randomUUID(),
            modelId: targetModel,
            messages: contextRes.context.messages,
            route: targetRoute,
            options: {
              numCtx: contextBudget,
            },
          },
          controller.signal
        );

        let finalUsage: { inputTokens?: number; outputTokens?: number } | undefined;
        let finalError: string | undefined;

        for await (const event of stream) {
          if (event.type === 'delta') {
            accumulatedContent += event.text;
            chunkCounter++;

            // Debounced write: flush every ~500ms or 20 tokens
            const now = Date.now();
            if (now - lastSaveTime > 500 || chunkCounter >= 20) {
              lastSaveTime = now;
              chunkCounter = 0;
              await store.updateMessage(assistantMsg.id, { content: accumulatedContent });
              await refresh();
            }
          } else if (event.type === 'usage') {
            finalUsage = { inputTokens: event.inputTokens, outputTokens: event.outputTokens };
          } else if (event.type === 'error') {
            finalError = event.code;
            break;
          } else if (event.type === 'done') {
            break;
          }
        }

        // Finalize message status
        if (finalError) {
          const isCancelled = finalError === 'CANCELLED';
          await store.updateMessage(assistantMsg.id, {
            content: accumulatedContent,
            status: isCancelled ? 'interrupted' : 'failed',
            errorCode: finalError,
          });
          announce(isCancelled ? 'Response cancelled' : 'Response failed');
        } else {
          await store.updateMessage(assistantMsg.id, {
            content: accumulatedContent,
            status: 'complete',
            usage: finalUsage,
          });
          announce('Response complete');
        }
      } catch (err: unknown) {
        const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message === 'CANCELLED');
        await store.updateMessage(assistantMsg.id, {
          content: accumulatedContent,
          status: isAbort ? 'interrupted' : 'failed',
          errorCode: isAbort ? 'CANCELLED' : 'NETWORK_ERROR',
        });
        announce(isAbort ? 'Response cancelled' : 'Response interrupted');
      } finally {
        setIsGenerating(false);
        setActiveGeneratingId(null);
        abortControllerRef.current = null;
        await refresh();
      }

      return true;
    },
    [store, isGenerating, prefs, consents, provider, refresh, models]
  );

  const retryMessage = useCallback(
    async (conversationId: string, failedMessage: Message): Promise<boolean> => {
      if (!store || isGenerating) return false;
      const history = await store.listMessages(conversationId);
      const msgIndex = history.findIndex((m) => m.id === failedMessage.id);
      if (msgIndex <= 0) return false;

      // Find preceding user prompt
      const userPrompt = history[msgIndex - 1];
      if (!userPrompt || userPrompt.role !== 'user') return false;

      // Delete the failed assistant message and re-send
      const tx = (store as unknown as { deleteMessage?: (id: string) => Promise<void> });
      if (tx.deleteMessage) {
        await tx.deleteMessage(failedMessage.id);
      } else {
        await store.updateMessage(failedMessage.id, { content: '', status: 'pending', errorCode: undefined });
      }

      return sendMessage(conversationId, userPrompt.content);
    },
    [store, isGenerating, sendMessage]
  );

  const value = useMemo<Ctx>(
    () => ({
      ready,
      store,
      storageError,
      prefs,
      setTheme,
      updatePreferences,
      conversations,
      refresh,
      newChat,
      reloadRequired,
      provider,
      providerStatus,
      models,
      refreshProvider,
      consents,
      saveConsent,
      revokeConsent,
      isGenerating,
      activeGeneratingId,
      contextNotice,
      sendMessage,
      retryMessage,
      stopGeneration,
    }),
    [
      ready,
      store,
      storageError,
      prefs,
      setTheme,
      updatePreferences,
      conversations,
      refresh,
      newChat,
      reloadRequired,
      provider,
      providerStatus,
      models,
      refreshProvider,
      consents,
      saveConsent,
      revokeConsent,
      isGenerating,
      activeGeneratingId,
      contextNotice,
      sendMessage,
      retryMessage,
      stopGeneration,
    ]
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
