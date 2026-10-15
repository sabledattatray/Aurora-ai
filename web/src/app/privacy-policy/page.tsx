import type { Metadata } from 'next';
import { Page } from '@/components/shared/Page';
export const metadata: Metadata = { title: 'Privacy policy' };

export default function Doc() {
  return (
    <Page title="Privacy policy">
      <p className="notice"><strong>Draft - not yet reviewed by a lawyer.</strong> This placeholder must be replaced with reviewed text, operator contact details, and a minimum age before any public launch.</p>
      <p>This draft policy outlines the data flows of Aurora AI. By default, conversations and attachments are processed strictly on your device and stored in your browser&apos;s local storage. If you choose to enable online models, data is only transmitted after you explicitly review and grant consent for the request or conversation.</p>
    </Page>
  );
}
