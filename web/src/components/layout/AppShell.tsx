'use client';
import { Suspense, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { toUserFacingError } from '@aurora/core';
import { APP_NAME } from '@/lib/config';
import { useApp } from '@/components/AppProvider';
import { SidebarContent } from './Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  const { storageError, reloadRequired, prefs, providerStatus, provider } = useApp();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  const toggleNavigation = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setDrawer((d) => !d);
    } else {
      setCollapsed((c) => !c);
    }
  };

  const storageMsg = storageError ? toUserFacingError(storageError) : null;

  const modelBadge = (() => {
    if (!prefs.preferredModel) {
      return { text: 'No model set up', label: 'Active model: none. Open settings.' };
    }
    const routeLabel = provider.route === 'cloud' ? 'Cloud' : 'On-device';
    if (providerStatus.state === 'reachable') {
      return {
        text: `${routeLabel} · ${prefs.preferredModel}`,
        label: `Active model: ${prefs.preferredModel} (${routeLabel.toLowerCase()}). Open settings.`,
      };
    }
    return {
      text: `Offline · ${prefs.preferredModel}`,
      label: `Model ${prefs.preferredModel} is currently unreachable. Open settings.`,
    };
  })();

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-bg focus:p-2">Skip to content</a>

      {/* Desktop sidebar */}
      {!collapsed && (
        <aside className="hidden w-72 shrink-0 border-r border-line bg-surface md:block" aria-label="Sidebar">
          <Suspense fallback={null}><SidebarContent onNavigate={() => {}} /></Suspense>
        </aside>
      )}

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(85vw,20rem)] bg-surface shadow-xl" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="flex justify-end p-1">
              <button type="button" className="btn-ghost flex items-center gap-1 text-sm" aria-label="Close menu" onClick={() => setDrawer(false)}>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>Close</span>
              </button>
            </div>
            <div className="h-[calc(100%-3rem)]"><Suspense fallback={null}><SidebarContent onNavigate={() => setDrawer(false)} /></Suspense></div>
          </aside>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button
            type="button"
            className="btn-ghost"
            aria-label={collapsed ? 'Show sidebar' : 'Toggle navigation'}
            aria-expanded={!collapsed}
            onClick={toggleNavigation}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>
          <Link href="/" className="font-semibold">{APP_NAME}</Link>
          <span className="flex-1" />
          <Link href="/settings/" className="pill" aria-label={modelBadge.label}>
            {modelBadge.text}
          </Link>
        </header>

        {storageMsg && (
          <div role="alert" className="notice m-3">
            {storageMsg.message} {storageMsg.nextStep}
          </div>
        )}
        {reloadRequired && (
          <div role="alert" className="notice m-3">
            Aurora was updated in another tab. Please reload this page to continue.
            <button type="button" className="btn ml-2" onClick={() => window.location.reload()}>Reload</button>
          </div>
        )}

        <main id="main" className="min-h-0 flex-1 overflow-y-auto" tabIndex={-1}>{children}</main>
        <div aria-live="polite" role="status" className="sr-only" id="status-region" />
      </div>
    </div>
  );
}
