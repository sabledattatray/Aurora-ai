import type { Metadata } from 'next';
import { Page } from '@/components/shared/Page';
export const metadata: Metadata = { title: 'Terms of use' };

export default function Doc() {
  return (
    <Page title="Terms of use">
      <p className="notice"><strong>Draft - not yet reviewed by a lawyer.</strong> This placeholder must be replaced with reviewed text, operator contact details, and a minimum age before any public launch.</p>
      <p>This draft document outlines the terms of use for Aurora AI. The software is provided under the terms of the MIT License. Users are responsible for models and content generated or processed locally on their devices, or via third-party online model endpoints.</p>
    </Page>
  );
}
