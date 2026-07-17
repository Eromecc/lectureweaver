# AGENTS.md

This is the operating guide for humans and coding agents working on LectureWeaver. The current target is **Milestone 2: preserve the deployable no-key demo and add optional, server-side multi-provider live analysis**.

## Repository structure

```text
src/
  app/                 Next.js entry points, global styles, and /api/analyze
  components/          Upload, provider selection, progress, results, evidence, patch UI
  domain/              Strict Zod domain, provider, and API contracts plus shared limits
  lib/
    ai/                Provider catalog, prompts, adapters, wire validation, error mapping
    analysis/          Semantic validation, trusted evidence, score, result/patch generation
    extraction/        Browser file validation, PDF/text parsing, normalization, chunking
    demo/              Sample loading, manifest verification, fixture orchestration
public/demo/           Synthetic PDF, TXT, Markdown, and fingerprint manifest
fixtures/              Strictly validated simulated analysis data
tests/                 Unit, integration, API, provider, and Testing Library coverage
.env.example           Optional server-only provider configuration, never real credentials
README.md              Judge path, setup, architecture, deployment, privacy, limitations
PRODUCT_SPEC.md        Product behavior, trust boundaries, and acceptance criteria
```

Keep browser extraction, server provider calls, pure analysis logic, and presentation concerns separate. Do not duplicate domain types in components or provider adapters.

## Commands

```bash
npm install            # install the pinned dependency graph
npm run dev            # start the local development server
npm run lint           # run ESLint
npm test               # run Vitest/Testing Library tests
npm run build          # create the production build
```

Run lint, tests, and a production build before handing off the milestone. The build must pass with no provider keys. Tests must use mocks and must not spend API credits.

## Domain and deterministic-output conventions

- Zod schemas are the single source of truth. Infer application types with `z.infer`; do not maintain parallel handwritten core-data interfaces.
- Keep TypeScript strict. Do not use `any` for core data or broad TypeScript/ESLint suppression comments.
- Use source types `slides`, `transcript`, `notes`; statuses `covered`, `partial`, `missing`, `contradiction`; importance `core`, `supporting`.
- Generate structural chunk IDs and trusted locators from parsed structure. Never trust fixture or provider output for source name, locator, heading path, or excerpt.
- Resolve evidence through a unique chunk map. Reject duplicate IDs, unknown references, invalid source combinations, invalid patch/status combinations, and zero assessments.
- Covered assessments have no patch. Partial, missing, and contradiction require a nonblank patch.
- Validate provider output through the strict wire schema, domain schema, and semantic rules before rendering it.
- Calculate coverage only in application code:

  ```text
  round(100 × (covered + 0.5 × partial) / all assessments)
  ```

- Missing and contradiction contribute zero; importance does not alter the score.
- Generate Markdown deterministically in missing → partial → contradiction order, core before supporting. Copy and download share the same string.

## Extraction and demo conventions

- Parse raw files in the browser. Dynamically load PDF.js client-side and use its bundled local worker.
- Support only text-based PDF slides, UTF-8 TXT transcripts, and UTF-8 Markdown notes.
- Preserve page locators, numbered paragraph locators, and Markdown heading paths.
- Recognize Markdown ATX and Setext headings only outside fenced code blocks.
- Enforce limits centrally: 10 MiB PDF, 1 MiB per text file, 120,000 normalized characters total, 100 chunks, and 1,800 characters per chunk.
- Reject unsafe or oversized input; never silently truncate it.
- Load sample assets as real `File` objects through the production ingestion path.
- Validate the fixture and apply it only after all ordered fingerprints match the manifest.
- Fail closed on a sample mismatch and direct the user to **Try demo**. Never apply the fixture to arbitrary input or after a live-analysis failure.
- **Try demo** is always fixture-only and must never issue a provider request, even when keys are configured.
- Label simulated results honestly.

## Live-analysis boundary

- Raw files and file bytes never cross `/api/analyze`. Send only the normalized, validated chunks plus the allowlisted provider/model selection.
- Normalized chunks contain source text. UI and docs must accurately state that live analysis transmits this text to the selected provider.
- Revalidate content type, body size, source types, chunks, IDs, per-chunk limits, and total limits on the server.
- The server chooses provider endpoints and reads credentials from its environment. Never accept a browser-supplied key or arbitrary base URL.
- Keep `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, and `KIMI_API_KEY` server-only. Never use a `NEXT_PUBLIC_` prefix or serialize credentials into the provider catalog.
- ChatGPT/Codex subscription entitlements are not OpenAI Platform API credits. Do not use Codex login tokens or ChatGPT cookies as application credentials.
- Apply bounded request size, provider timeout, and model-output limits. Treat empty, refused, filtered, truncated, malformed, oversized, or semantically invalid provider output as an error.
- Map expected failures to the stable API error envelope without leaking provider response bodies, keys, prompts, or internal stack traces.
- Preserve the local source map when a provider is absent or fails.
- Do not add authentication, a database, persistence, analytics, or logging of source content as part of this milestone.

## Provider conventions

Environment configuration:

```text
OPENAI_API_KEY       optional
OPENAI_MODEL         default gpt-5.6
DEEPSEEK_API_KEY     optional
DEEPSEEK_MODEL       default deepseek-v4-flash
KIMI_API_KEY         optional
KIMI_MODEL           default kimi-k3
KIMI_REGION          cn (default) or global
```

- **OpenAI:** use the Responses API, `store: false`, bounded `max_output_tokens`, and `zodTextFormat`/strict Structured Outputs. Handle explicit refusal and incomplete output, then still run domain and semantic validation. The official `gpt-5.6` alias currently routes to GPT-5.6 Sol.
- **DeepSeek:** use `https://api.deepseek.com/chat/completions`, JSON Output, an explicit JSON instruction/schema example, bounded `max_tokens`, and strict local validation. JSON Output is not schema adherence and can occasionally return empty content. Keep DeepSeek-only fields isolated.
- **Kimi:** use Chat Completions with `json_schema`, `strict: true`, and bounded `max_completion_tokens`. `cn` maps to `https://api.moonshot.cn/v1`; `global` maps to `https://api.moonshot.ai/v1`. Parse final message content, not reasoning content.
- Treat missing/blank `KIMI_REGION` as `cn`, but fail closed on every other value outside `cn|global`; never silently route a typo to a regional endpoint.
- Do not assume OpenAI-compatible providers implement OpenAI Responses or identical Chat Completions parameters.
- Keep catalog models allowlisted. A deployment-specific environment default may be added to its provider catalog only after model-ID validation; the client must not choose arbitrary IDs outside the catalog.

Official references:

- OpenAI: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
- DeepSeek: [current models/API quick start](https://api-docs.deepseek.com/), [JSON Output](https://api-docs.deepseek.com/guides/json_mode/)
- Kimi: [regional quick start](https://platform.kimi.com/docs/overview), [model list](https://platform.kimi.ai/docs/models), [Structured Output](https://platform.kimi.com/docs/guide/response_format)

## UI conventions

- Keep the primary path usable by keyboard and touch with semantic labels, visible focus, sufficient contrast, and overlay focus restoration.
- Keep **Try demo** prominent and no-key.
- Show configured/unconfigured provider state without revealing credentials.
- Distinguish extraction, live analysis, simulated analysis, and source-map-only states honestly.
- Treat initial, extracting, live loading, success, empty, validation failure, textless PDF, fingerprint mismatch, provider errors, retry, and reset as first-class states.
- On narrow screens, prevent horizontal overflow and present evidence as an accessible sheet/dialog.
- Render user, fixture, and provider Markdown without unsafe raw HTML.
- Reject raw HTML, Markdown images, autolinks, Markdown links/references, and bare external URLs in suggested patches before export.
- Derive cards, counts, filters, evidence, and patch content from validated domain objects.

## Milestone 2 constraints

Do not add:

- authentication, accounts, databases, server persistence, saved projects, analytics, or payments;
- user-supplied API keys, arbitrary provider endpoints, or browser-visible secrets;
- Notion, audio, PPTX, OCR, embeddings, vector search, chat, or collaboration;
- real student content, generated credentials, committed `.env` files, or source-text logging;
- a silent provider fallback that could charge a different service or mislabel result provenance;
- placeholder behavior in the demo or live-analysis path.

`.env.example` contains names and defaults only. Real values belong in untracked `.env.local` or the deployment secret store.

## Public deployment and cost safety

`/api/analyze` spends the deployment owner's provider credits. Existing byte, token, and timeout limits do not prevent distributed abuse. Before a live deployment is public, require an explicit plan for access control or authentication, per-user/IP rate limits, quotas, provider budget alerts or hard limits, monitoring, and an emergency disable path. If those controls are not in scope, recommend a private/access-restricted deployment or omit provider keys and ship only the no-key demo.

## Testing expectations

Add focused regression coverage for behavior changes:

- schemas, duplicate IDs, provider catalog/target validation, request limits, and API error envelopes;
- normalization, ordering, locators, chunk caps, Unicode, CRLF, headings, and fenced-code exclusions;
- score rounding, all statuses, zero-assessment rejection, evidence hydration, and deterministic Markdown;
- sample ingestion, fingerprint mismatch, provider-unconfigured behavior, and accessible UI interactions;
- OpenAI structured parse/refusal/length/error mapping;
- DeepSeek JSON parsing, empty/length/error cases, and Kimi strict-schema request/response handling;
- timeout, authentication, balance, rate-limit, and invalid-output failures with mocked network responses.

Tests use synthetic data. Avoid snapshots that conceal meaningful domain changes. Never call a paid provider from the test suite.

## Safe collaboration

- Work on the current branch unless the task explicitly requests a branch or publication workflow.
- Inspect the worktree before editing and preserve unrelated user or agent changes.
- Prefer small, reviewable patches and pure helpers.
- Use `rg`/`rg --files` for discovery.
- Keep fixture and manifest changes synchronized with extraction behavior and integration tests.
- Update `README.md`, `PRODUCT_SPEC.md`, `AGENTS.md`, and `.env.example` when provider behavior, privacy boundaries, variables, or deployment requirements change.

## Definition of done

Milestone 2 is complete only when:

- `npm install`, `npm run lint`, `npm test`, and `npm run build` pass with no provider key required;
- **Try demo** remains a complete, deterministic, no-request judge path under two minutes;
- raw files parse locally and live analysis transmits only normalized chunks;
- configured OpenAI, DeepSeek, and Kimi adapters follow their provider-specific contracts;
- all provider output passes Zod and semantic validation before trusted hydration;
- score/counts/Markdown remain application-computed and deterministic;
- unconfigured and failed live flows preserve the source map and recovery actions;
- credentials stay server-only and no source content or secret is persisted;
- there is no authentication, database, history, analytics, or payment system;
- public deployment documentation includes the API-credit and abuse-control warning.
