# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.1.0] - 2026-10-15

### Added
- **Milestone 2 - Local AI (P0)**:
  - Core Provider interface, model capabilities, and streaming event abstractions in `@aurora/core`.
  - Privacy Router with `local-only` (default) and `ask-before-cloud` mode enforcement.
  - Context window manager (`buildContextWindow`) with token budget calculations and persistent truncation notice when older turns are dropped.
  - SSRF protection via strict loopback address validator (`isLoopbackEndpoint`).
  - Single network gateway module (`web/src/lib/net/gateway.ts`) enforcing zero external calls in Local-only mode.
  - Ollama local provider (`OllamaProvider`) with connection test, model discovery, model show, cancellation, and NDJSON streaming parser (`parseNDJSONStream`).
  - Active route & model header badge (`On-device · <model>`).
  - Setup and troubleshooting diagnostic panel in Settings and Help pages for `OLLAMA_ORIGINS`, CORS, and port issues.

- **Milestone 3 - Hosted AI Gateway (P0)**:
  - Cloudflare Worker gateway in `gateway/` exposing `/api/chat`, `/api/health`, and `/api/models`.
  - Request validation: message count, character limits, model allowlist, content-type, origin check, and `X-Aurora-Consent` header.
  - Hashed client IP rate-limiting with rotating salt and kill-switch control.
  - Cloudflare Workers AI adapter translating SSE upstream streams into Aurora SSE events.
  - Client-side `HostedWorkersAIProvider` and `ConsentDialog` with plain-language disclosure, terms links, and conversation-level or one-time consent granting.

- **Milestone 4 - Export/Import (P0) & Document Security (P1)**:
  - Documented schema `aurora-export` v1 with strict structural validation.
  - Atomic IndexedDB import with fresh UUID remapping to avoid collisions.
  - Import preview modal (`ImportModal`) with file size checks and conversation/message count summaries.
  - File sniffing and magic byte verification for `.pdf` (`%PDF-`), `.xlsx` (`PK\x03\x04`), `.csv`, and `.txt`/`.md`.
  - Anti-formula injection neutralisation for spreadsheet cells (`=`, `+`, `-`, `@`).
  - Read-only SQL validator for DuckDB in-memory analysis (rejects DML, DDL, file functions, and multiple statements).
  - BM25 local ranking and text chunker with overlap and page tracking.
  - Anti-prompt-injection delimited `<document_context>` wrappers.

- **Milestone 5 - Hardening, Quality & Release (P0)**:
  - Security headers and CSP configuration in `web/public/_headers`.
  - Automated secret scanner and Local-only isolation test suite (`web/src/security.test.ts`).
  - Complete documentation suite across `docs/`.
