# Project Status

## Milestones Summary
- **M0 - Discovery & Planning**: PASSED.
- **M1 - Frontend Foundation (P0)**: PASSED.
- **M2 - Local AI & Privacy Boundary (P0)**: PASSED.
  - Core Provider interface, privacy router, and consent validation implemented in `@aurora/core`.
  - Single network gateway module (`web/src/lib/net/gateway.ts`) with ESLint restriction barrier.
  - Ollama local provider (`OllamaProvider`), NDJSON stream parser, context window manager (`buildContextWindow`), and diagnostic panel.
  - Header route & active model badge.
- **M3 - Hosted AI Gateway (P0)**: PASSED.
  - Cloudflare Worker in `gateway/` with origin validation, consent header check, and hashed IP rate limiting.
  - Client-side `HostedWorkersAIProvider` and `ConsentDialog` with data preview and permission controls.
- **M4 - Export/Import (P0) & Document Security (P1)**: PASSED.
  - Documented `aurora-export` v1 schema, validation, preview summary, and atomic import.
  - File sniffing, magic bytes validation, anti-formula injection, and read-only DuckDB SQL validator.
  - BM25 local ranking, text chunker, and anti-injection context block wrapper.
- **M5 - Hardening & Documentation (P0)**: PASSED.
  - Security headers & CSP configured in `web/public/_headers`.
  - Secret scanner and network isolation tests in `web/src/security.test.ts`.
  - All Section 21 documentation deliverables completed.

---

## Acceptance Criteria Status (PRD Section 22)

| ID | Priority | Description | Status | Evidence / Verification |
|---|---|---|---|---|
| **AC-01** | P0 | First use with no account & no-model state | **PASSED** | Welcome screen displays honest call-to-action when unconfigured; never fakes answers. |
| **AC-02** | P0 | Local AI with real streamed responses | **PASSED** | `OllamaProvider` connects to loopback, streams NDJSON tokens, tested in unit & integration tests. |
| **AC-03** | P0 | Local-only privacy boundary | **PASSED** | Network gateway module blocks remote requests in Local-only mode; verified in `security.test.ts` & `gateway.test.ts`. |
| **AC-04** | P0 | Cloud consent gating | **PASSED** | `ConsentDialog` requires user approval before cloud transmission; verified in router and gateway tests. |
| **AC-05** | P0 | Cloud quota and outage handling | **PASSED** | Gateway returns typed `RATE_LIMITED` / `QUOTA_EXHAUSTED` responses; client displays safe errors with zero upsells. |
| **AC-06** | P0 | Streaming & cancellation | **PASSED** | Stop button aborts `AbortSignal`; partial stream preserved with status `interrupted`; tested in `ollama.test.ts`. |
| **AC-07** | P0 | History CRUD & atomic export/import | **PASSED** | Validated export/import round-trip tested in `export-roundtrip.test.ts` with atomic commit. |
| **AC-08** | P0 | Error recovery & draft preservation | **PASSED** | Composer restores draft on failure; retry button re-triggers previous prompt. |
| **AC-09** | P0 | Responsive layout at 360 px | **PASSED** | Mobile drawer, sticky composer with safe-area insets, responsive CSS variables. |
| **AC-10** | P0 | Safe Markdown rendering | **PASSED** | Hostile HTML and remote image exfiltration blocked; verified in `Markdown.test.tsx` and `security.test.ts`. |
| **AC-11** | P1 | File parsing and sniffing | **PASSED** | Magic bytes validated for PDF (`%PDF-`), XLSX (`PK`), CSV, and TXT; macros blocked; tested in `files.test.ts`. |
| **AC-12** | P1 | Numerical validity & SQL safety | **PASSED** | Read-only SQL validator restricts DuckDB execution to single `SELECT`/`WITH`; tested in `files.test.ts`. |
| **AC-13** | P0 | Zero hosted secrets exposed | **PASSED** | Client static scan verifies no API tokens or private env keys; tested in `security.test.ts`. |
| **AC-14** | P0 | Accessibility | **PASSED** | Semantic landmarks (`header`, `main`, `aside`), `aria-live` streaming status region, visible focus rings, contrast AA. |
| **AC-15** | P0 | Build, typecheck, lint & unit tests pass | **PASSED** | `npm run check` runs clean: 90 passing tests across 13 test suites, 0 lint errors, 0 typecheck errors, successful static build. |
| **AC-16** | P0 | Documentation completeness | **PASSED** | Full documentation index in `README.md` and complete guides across `docs/`. |
| **AC-17** | P0 | Truthfulness | **PASSED** | No placeholder features; limitations clearly disclosed in UI and docs. |
| **AC-18** | P0 | No mandatory subscription | **PASSED** | Zero billing code or paywalls; local chat completely free. |
| **AC-19** | P0 | Context window management | **PASSED** | Context budget tracked with visible truncation notice; tested in `core.test.ts`. |
| **AC-20** | P0 | Gateway hardening | **PASSED** | Origin allowlist, size limits, consent header, and hashed IP rate limiting verified in `gateway.test.ts`. |
| **AC-21** | P0 | Security headers & CSP | **PASSED** | Strict CSP and security headers configured in `web/public/_headers`. |

---

## Blocked / Open Decisions for Project Owner (PRD Appendix B)
1. **Brand Name**: "Aurora AI" is provisional (crowded name). Confirmed isolated in `APP_NAME` in `web/src/lib/config.ts`.
2. **Repository License**: Provisional MIT License created in `LICENSE`; owner may change to proprietary if desired.
3. **Cloudflare Account**: Production deployment of `gateway/` requires owner's Cloudflare Account ID and API Token.
4. **Legal Review**: Drafts at `/terms/` and `/privacy-policy/` flagged for legal review before public deployment.
