# Contributing to Aurora AI

Thank you for your interest in contributing to Aurora AI. This document outlines development guidelines and contribution standards.

## Code Standards and Guiding Principles
1. **Privacy-first**: Local-only mode MUST NOT transmit prompts, conversations, or file content to any remote server or gateway. All network requests must pass through `web/src/lib/net/gateway.ts`.
2. **Deterministic & Safe**: Models make mistakes. Arithmetic, data transformations, and SQL operations must be deterministic.
3. **No Fabricated Data**: Never invent test results, quotas, metrics, or benchmark figures.
4. **Accessible**: Follow WCAG 2.2 AA standards (semantic landmarks, keyboard accessibility, contrast ratios).
5. **No Secrets in Bundles**: Secrets belong exclusively in server environments, never in client source or git-tracked configuration.

## Development Workflow
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run development server:
   ```bash
   npm run dev
   ```
3. Run verification checks before submitting PRs:
   ```bash
   npm run check
   ```
   All tests, type checks, lint checks, and static builds must pass.

## Submitting Pull Requests
- Use conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
- Document new architectural decisions in `docs/DECISIONS.md`.
- Keep changes focused and provide automated unit or integration tests for new features.
