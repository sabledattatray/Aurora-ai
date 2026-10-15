import type { Metadata } from 'next';
import { APP_NAME, APP_VERSION } from '@/lib/config';
import { Page } from '@/components/shared/Page';
export const metadata: Metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <Page title={`About ${APP_NAME}`}>
      <p>Version {APP_VERSION}. Aurora is an independent, local-first AI assistant. It is not affiliated with any other AI product or company.</p>
      <h2>Current status</h2>
      <ul>
        <li><strong>On-device AI:</strong> Connect to local runtime via Ollama with full streaming, context management, and offline operation. A zero-setup built-in assistant is also available.</li>
        <li><strong>Optional Hosted Gateway:</strong> Cloudflare Workers AI gateway and OpenAI-compatible API connectivity gated by explicit user consent.</li>
        <li><strong>Privacy Boundary:</strong> Local-only mode guarantees zero outbound calls to cloud services or telemetry.</li>
        <li><strong>Portability & Backup:</strong> Atomic export and import with validated JSON schemas and collision-free ID remapping.</li>
        <li><strong>Document Processing & Safety:</strong> Safe file parsing (PDF, CSV, XLSX, Markdown), magic byte verification, formula injection neutralisation, and read-only SQL execution.</li>
      </ul>
      <h2>Limitations</h2>
      <ul>
        <li>AI models can hallucinate. Always verify important factual, financial, or legal information.</li>
        <li>Local models need a capable computer (sufficient RAM and CPU/GPU); phones generally cannot run large models locally.</li>
        <li>History is stored in your browser&apos;s IndexedDB and will be lost if browser site data is cleared. Regular JSON exports are recommended.</li>
      </ul>
      <h2>Licences & Notices</h2>
      <p>Aurora is released under the MIT License. See <code>THIRD_PARTY_NOTICES.md</code> in the repository for open-source component attributions.</p>
    </Page>
  );
}
