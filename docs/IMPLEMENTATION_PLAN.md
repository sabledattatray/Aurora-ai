# Implementation Plan

Follows PRD v1.1 (`AURORA AI.md`), Section 4.

## Current State
- **M0 - Discovery and Plan**: Baseline structure, npm workspaces, strict TypeScript, lint, test, build scripts.
- **M1 - Frontend Foundation**: Responsive shell, safe Markdown, themes, IndexedDB conversations storage and management, "no model configured" state. (Verified: 30 unit tests pass, typecheck passes, lint passes, build passes).

---

## Milestone 2: Local AI (P0)
**Objective**: Connect a real or contract-faithful local Ollama runtime, stream responses, manage context windows, and enforce the local-only privacy boundary in code.

### Tasks
1. **Core Abstractions (`packages/core`)**:
   - Provider interface (`Provider`, `ProviderStatus`, `ModelInfo`, `Capabilities`, `ChatRequest`, `StreamEvent`).
   - Privacy router (`decideRoute`, privacy modes `local-only` vs `ask-before-cloud`).
   - Consent entities & helpers (`ConsentRecord`, `isConsentValid`).
   - Context-window manager (`truncateContext`): calculate token budget, reserve output tokens, drop oldest turns, provide persistent truncation notice.
   - Loopback verification utility (`isLoopbackEndpoint`): strict restriction to `127.0.0.1`, `localhost`, `[::1]` (SSRF protection).
   - Default system prompt (`DEFAULT_SYSTEM_PROMPT` v1.0).
2. **Network Gateway Discipline (`web/src/lib/net/gateway.ts`)**:
   - Central networking module where all outbound HTTP requests are checked against the active privacy mode.
   - Satisfies ESLint `no-restricted-globals` / `no-restricted-properties` rules.
3. **Ollama Provider (`web/src/lib/providers/ollama.ts`)**:
   - Connection test (`GET /api/tags`) with short timeout.
   - Model discovery and capability detection (`POST /api/show`).
   - NDJSON streaming parser (`POST /api/chat`) with explicit `num_ctx`, cancellation via `AbortSignal`, timeout, and typed error mapping (`PROVIDER_UNAVAILABLE`, `LOCAL_ENDPOINT_BLOCKED`, `REQUEST_TIMEOUT`, `CANCELLED`).
4. **UI Integration**:
   - State management updates in `AppProvider` for active provider, runtime status, and selected model.
   - Route badge in header ("On-device · <model>").
   - Full diagnostic panel in Settings and error displays (runtime status, origin instructions, browser permissions, copy diagnostic info).
   - Composer & ChatView activation when model is configured: real streaming, Stop generation button, in-flight submission guard, draft preservation on error, retry button.
5. **Testing**:
   - Router matrix unit tests.
   - Context window truncation unit tests.
   - NDJSON stream reader unit tests (split chunks, multi-byte UTF-8, abort).
   - Ollama provider integration tests against a contract-faithful mock server.
6. **Exit Criteria**:
   - AC-02, AC-03 (local-only), AC-06, AC-08 PASSED.
   - Lint, typecheck, tests, and build pass.

---

## Milestone 3: Hosted AI (P0)
**Objective**: Cloudflare Worker gateway and client adapter for optional hosted inference within free provider limits, gated by explicit consent.

### Tasks
1. **Gateway Worker Workspace (`packages/gateway` or `gateway/`)**:
   - `POST /api/chat`: validation (Content-Type, size, message length, model allowlist, Origin, `X-Aurora-Consent`).
   - Atomic rate-limiting and concurrency controls.
   - Cloudflare Workers AI streaming adapter (SSE translation).
   - `GET /api/health`: zero inference cost, returns version and health status.
   - `GET /api/models`: returns server-side model allowlist.
2. **Client Gateway Adapter & Consent Flow (`web/src/lib/providers/hosted.ts`)**:
   - Client hosted provider communicating via `lib/net/gateway.ts`.
   - Consent dialog component (`ConsentDialog`): plain language disclosure, data preview, "Send once", "Allow for this conversation", "Stay on-device".
   - Storage of `ConsentRecord` in IndexedDB.
   - Consent revocation in Settings > Privacy.
3. **Testing**:
   - Gateway validation, origin rejection, consent header enforcement, rate limit tests.
   - Hosted provider client tests.
4. **Exit Criteria**:
   - AC-04, AC-05, AC-13 PASSED.

---

## Milestone 4: Export/Import (P0) and Document Processing (P1)
**Objective**: Complete backup & portability (P0), followed by local-first document question answering and spreadsheet analysis (P1).

### Tasks
1. **Export/Import (P0)**:
   - Documented schema `aurora-export` version 1.
   - Validation, preview modal ("N conversations, M messages"), atomic commit into IndexedDB.
   - Round-trip tests (export -> clear -> import -> match).
2. **Document Processing (P1)**:
   - File attachment handling in composer (`.txt`, `.md`, `.pdf`, `.csv`, `.xlsx`).
   - Worker-based parsing: PDF.js text extraction with page tracking, Papa Parse for CSV, ExcelJS/read-excel-file for spreadsheets (no macro execution).
   - BM25 local ranking for document Q&A with source references ("Sources: p. 4, p. 9").
   - DuckDB-Wasm for spreadsheet analysis: read-only SELECT validation, deterministic arithmetic, shown SQL.
3. **Exit Criteria**:
   - AC-07 fully PASSED (P0).
   - AC-11, AC-12 PASSED (P1).

---

## Milestone 5: Hardening, Verification, and Release Documentation (P0)
**Objective**: Comprehensive security controls, privacy audit, accessibility verification, and complete documentation.

### Tasks
1. **Security & Privacy Hardening**:
   - Content Security Policy (CSP) headers and deployment config.
   - Secret scanner (verify zero API keys or server env names in client bundles).
   - Local-only network isolation verification test.
   - Accessible keyboard traps, polite `aria-live` streaming announcements.
2. **Documentation & Release Deliverables (PRD Section 21 & AC-16)**:
   - `README.md`, `CONTRIBUTING.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `SECURITY.md`, `CHANGELOG.md`, `.env.example`.
   - `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/PROJECT_STATUS.md`, `docs/KNOWN_LIMITATIONS.md`, `docs/QUALITY_REPORT.md`, `docs/PRIVACY_DATA_FLOW.md`, `docs/PROVIDER_SETUP.md`, `docs/DEPLOYMENT.md`, `docs/TROUBLESHOOTING.md`.
3. **Exit Criteria**:
   - All P0 acceptance criteria (AC-01 through AC-10, AC-13 through AC-21) PASSED.

---

## Assumptions
- Node.js 22 LTS, npm workspaces.
- Static export frontend (`output: "export"`) with local-first IndexedDB persistence.
- Local inference powered by Ollama running on loopback (`http://127.0.0.1:11434`).
- Cloud gateway powered by Cloudflare Workers (separate deployable package).
- Zero paid API requirement.
- No analytics and no third-party tracking.

## Risks & Mitigations
- **Browser-to-Localhost Network Blocking**: Mixed content (HTTPS to HTTP) or Chromium Private Network Access prompts. Mitigation: loopback-only validation, rich diagnostic panel with step-by-step remedies, self-hosted local server option.
- **Supply-Chain & Bundle Size**: Uncontrolled dependencies can bloat initial JS or introduce vulnerabilities. Mitigation: strict dependency pinning, lazy-loading heavy modules, zero client telemetry, automated bundle secret scanning.
- **Silent Cloud Fallback Risk**: Accidental transmission in Local-only mode. Mitigation: central `lib/net/gateway.ts` barrier enforced by ESLint restricted globals and automated network interception tests.
