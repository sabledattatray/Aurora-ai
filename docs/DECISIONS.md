# Architectural Decisions Log (ADR)

This document records key technical decisions, their context, alternatives considered, and trade-offs per PRD Section 0 and Section 21.

---

### ADR-01: Static Export with Query-Based Routing
- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: Conversations live strictly in client-side IndexedDB. Next.js dynamic path segments (e.g. `/chat/[id]`) cannot be statically pre-rendered for unknown, user-created IDs.
- **Decision**: Configure Next.js for static export (`output: 'export'`) and route conversations via query parameters (`/chat/?c=<id>`).
- **Trade-off**: Query URLs instead of clean pathname slugs, but guarantees 100% static hosting compatibility without any server runtime.

### ADR-02: Single Network Gateway Module & ESLint Barrier
- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: The core promise of Local-only mode is that user data never leaves the device. If fetch calls were scattered across components, auditing network safety would be impossible.
- **Decision**: Route all network operations through `web/src/lib/net/gateway.ts`. Enforce this in CI via ESLint `no-restricted-globals` banning `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, and `navigator.sendBeacon` outside `src/lib/net/**`.
- **Trade-off**: Small developer discipline requirement, but enables provable privacy verification.

### ADR-03: Browser Direct Connection to Loopback for Ollama
- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: Local inference could either be proxied through a server or connected directly from browser to localhost.
- **Decision**: The browser connects directly to `http://127.0.0.1:11434`. The gateway can never and must never proxy requests to user localhost (eliminates SSRF and keeps prompts local).
- **Trade-off**: Requires users to configure `OLLAMA_ORIGINS="*"` on Ollama and handle browser Mixed-Content / Private Network Access rules. Mitigated by comprehensive diagnostics.

### ADR-04: Explicit Context Window Management (num_ctx)
- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: Ollama defaults to a conservative 2048 token window and silently truncates context without notice.
- **Decision**: Explicitly send `num_ctx` on Ollama requests (default 4096 tokens). Implement client-side budget tracking (`buildContextWindow`) that preserves the system prompt and latest user prompt, drops oldest turns first, and surfaces a visible truncation notice in the UI.
- **Trade-off**: Slight overhead in character-to-token estimation heuristics, but completely prevents silent data loss.

### ADR-05: Cloud Gateway via Cloudflare Worker
- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: Hosted inference needs server-side credentials and rate limiting without requiring a full backend container.
- **Decision**: Deploy a Cloudflare Worker in `gateway/` integrating Cloudflare Workers AI. Keyed rate-limiting uses hashed client IPs with rotating salt.
- **Trade-off**: Requires Cloudflare platform for hosted mode, but preserves static hosting for the web client.

### ADR-06: Strict Schema Validation & Atomic Import/Export
- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: Importing arbitrary JSON files poses security risks (XSS, prototype pollution, corrupted storage).
- **Decision**: Implement `aurora-export` schema v1 with strict structural validation. Import generates new UUIDs to prevent ID collisions and commits all conversations and messages in a single atomic IndexedDB transaction.
- **Trade-off**: Cannot export attachment blobs in v1 (metadata only), but ensures reliable round-trip portability.

### ADR-07: Anti-Formula Injection & Text-to-SQL Read-Only Verification
- **Date**: 2026-10-15
- **Status**: Accepted
- **Context**: Model output and spreadsheet data can carry formula injection (`=`, `+`, `-`, `@`) or hostile SQL commands.
- **Decision**: Prepend `'` to dangerous formula characters in spreadsheets. Validate proposed text-to-SQL queries with a strict allowlist regex (single read-only `SELECT`/`WITH` only; disallow `DROP`, `INSERT`, `PRAGMA`, file functions).
- **Trade-off**: Advanced SQL features (temp tables, multi-statements) are dished, but security is guaranteed.
