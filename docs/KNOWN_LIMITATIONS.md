# Known Limitations & Platform Caveats

This document honestly outlines observed technical limitations, platform variances, and boundaries per PRD Section 0, Section 1.7, and Section 19.5.

## 1. Local Runtime Hardware Constraints
- **Hardware Requirement**: Running local models (e.g. Llama 3 8B) requires a capable desktop or laptop computer with sufficient RAM (typically 8 GB to 16 GB+) and CPU/GPU resources.
- **Mobile Devices**: Smartphones and tablets generally cannot run Ollama directly. Mobile users in MVP must either use the hosted route (with explicit consent) or connect to a local network instance (planned for P2).
- **Cold-Start Delay**: The first request sent after Ollama loads a model from disk into RAM may take several seconds before generating the first token.

## 2. Browser Networking & Localhost Access
- **CORS Configuration**: By default, web browsers block web applications from accessing `http://127.0.0.1:11434` unless Ollama is started with `OLLAMA_ORIGINS="*"`.
- **Private Network Access (PNA)**: Chromium browsers may display a permission prompt when a web page accesses loopback resources. If denied, the connection fails with `LOCAL_ENDPOINT_BLOCKED`.
- **Mixed Content**: Loading the hosted HTTPS website while connecting to plain HTTP loopback (`http://127.0.0.1:11434`) is permitted by Chromium for loopback addresses, but other browsers (e.g. certain Safari versions) may restrict mixed content. The self-hosted local server (`npm run dev`) avoids this constraint.

## 3. Storage & Multi-Tab Persistence
- **Browser Eviction (Safari Caveat)**: While the app requests persistent storage via `navigator.storage.persist()`, WebKit/Safari enforces aggressive 7-day client-side storage eviction for websites not visited recently. Users are advised to regularly export important conversations.
- **Private / Incognito Mode**: In private browsing windows, IndexedDB storage is volatile and automatically cleared when the session closes.
- **Multi-Tab Sync**: When database schema updates occur across tabs, a reload banner is shown to prevent version conflicts. Live real-time inter-tab streaming sync is not implemented.

## 4. Legal & Compliance
- **Terms of Service & Privacy Policy**: The draft legal documents at `/terms/` and `/privacy-policy/` are implementation templates and must undergo professional legal review before any commercial or public deployment.
- **Model Truthfulness**: AI models can hallucinate. Deterministic arithmetic and file parsing are separated from model generations, but all AI-generated textual claims should be verified for critical applications.
