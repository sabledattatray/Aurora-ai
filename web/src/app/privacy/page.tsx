import type { Metadata } from 'next';
import Link from 'next/link';
import { Page } from '@/components/shared/Page';
export const metadata: Metadata = { title: 'Privacy' };

export default function PrivacyPage() {
  return (
    <Page title="Privacy">
      <p><strong>Local-first architecture.</strong> Aurora stores your messages, settings, and conversation history in this browser. You control retention, export, and deletion.</p>
      <h2>Privacy Modes</h2>
      <ul>
        <li><strong>Local-only (Default):</strong> Aurora strictly blocks any outbound transmission to external servers or cloud inference. All inference runs directly on your device via Ollama or the in-browser assistant. Zero analytics, zero telemetry.</li>
        <li><strong>Ask-before-cloud (Optional):</strong> If you configure a hosted model (Cloudflare Workers AI or custom OpenAI-compatible endpoint), Aurora displays an explicit consent dialog previewing what will be sent. Data is never transmitted without your active permission.</li>
      </ul>
      <h2>Where your data lives</h2>
      <ul>
        <li><strong>Conversations and settings:</strong> In this browser&apos;s IndexedDB on your device. Storage is unencrypted by default.</li>
        <li><strong>Message drafts:</strong> In this tab&apos;s session storage until sent or closed.</li>
        <li><strong>Analytics and error reporting:</strong> None. No third-party trackers or telemetry scripts.</li>
      </ul>
      <h2>Hosted Gateway Protections</h2>
      <p>When you choose to use Aurora&apos;s hosted gateway, client IP addresses are cryptographically hashed with rotating salt, no prompts or model outputs are logged or stored, and requests are strictly capped to prevent abuse.</p>
      <h2>Your controls</h2>
      <p>You can revoke granted cloud permissions at any time in <Link href="/settings/">Settings</Link>, delete individual conversations from the sidebar, or export/wipe all data at any moment.</p>
      <p className="text-sm text-muted">See also the <Link href="/privacy-policy/">privacy policy</Link> (draft).</p>
    </Page>
  );
}
