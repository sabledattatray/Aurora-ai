'use client';
import type { ReactNode } from 'react';
import { AppProvider } from './AppProvider';
import { AppShell } from './layout/AppShell';

export function AppRoot({ children }: { children: ReactNode }) {
  return <AppProvider><AppShell>{children}</AppShell></AppProvider>;
}
