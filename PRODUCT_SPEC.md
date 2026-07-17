# LectureWeaver Product Specification

## Product definition

**Category:** Education

**Milestone:** 2 — no-key demo plus optional multi-provider live analysis

LectureWeaver helps students verify whether important information from lecture slides and transcripts is covered, partially covered, missing, or contradicted in their existing notes.

It is not a general summarizer. Its core promise is completeness-first, evidence-linked review: every finding must resolve to a trusted locator produced from the user's parsed source files.

## Audience and milestone outcome

The primary user has lecture slides, a transcript, and Markdown notes but cannot quickly determine whether the notes preserve important teaching content. Manual comparison is slow, while ungrounded generation can hide omissions or fabricate support.

Milestone 2 serves two entry points:

1. A judge or visitor can understand the product in under two minutes through **Try demo**, with no key, account, or model request.
2. A deployment owner may configure OpenAI, DeepSeek, and/or Kimi server credentials so users can analyze their own normalized source chunks.

## Product principles

1. **Completeness before condensation.** Classify coverage; do not merely rewrite the lecture.
2. **Evidence before assertion.** Every assessment resolves to current parsed chunks with visible locators.
3. **Trusted provenance.** Models may return chunk IDs and relevance, but never own filenames, locators, heading paths, or excerpts.
4. **Deterministic where possible.** Application code calculates score, counts, ordering, evidence hydration, and Markdown.
5. **Fail closed.** Invalid input or provider output never becomes a plausible-looking result.
6. **Local extraction.** Raw files are parsed in the browser; only normalized chunks are sent for an explicitly selected, configured live analysis.
7. **Optional service.** No provider credential is required for the build, source-map flow, or sample demo.
8. **No hidden persistence.** Milestone 2 adds no account, database, saved history, analytics, or application-level source storage.

## Core user flows

### One-click no-key demonstration

1. The user selects **Try demo**.
2. The browser loads the checked-in synthetic PDF, TXT transcript, and Markdown notes as real `File` objects.
3. The production validation, extraction, normalization, and chunking pipeline processes all three files.
4. Ordered normalized fingerprints are compared with the checked-in manifest.
5. Strict Zod and semantic rules validate the simulated fixture.
6. The app hydrates trusted evidence, calculates score/counts, and assembles deterministic Markdown.
7. The user filters findings, opens evidence, and copies or downloads the generated Markdown.

This flow never calls a live provider, even when provider keys exist.

### Live analysis of user-selected material

1. The user selects one text-based PDF lecture, one UTF-8 TXT transcript, and one UTF-8 Markdown notes file.
2. The browser validates and parses the raw files locally into normalized chunks with structural IDs and locators.
3. The user chooses a provider/model exposed by the deployment catalog.
4. If that provider is configured, the browser posts only the normalized chunks and selected target to `/api/analyze`.
5. The server resolves its own allowlisted provider endpoint and server-only key. The client cannot submit a key or arbitrary base URL.
6. The adapter requests a structured analysis and maps provider failures to a stable application error contract.
7. The result must pass the wire Zod schema, domain Zod schema, uniqueness/reference validation, and evidence/status semantic rules.
8. The browser hydrates trusted evidence from its local chunk map and calculates deterministic score, counts, ordering, and Markdown.

### Unconfigured or failed live analysis

- If the selected provider has no server key, no chunks are sent; valid input displays a local source map and offers **Try demo**.
- If a provider rejects, times out, rate-limits, truncates, or returns invalid output, the source map remains available and the user can retry or choose another configured provider.
- Replacing or resetting files clears stale analysis output.

## Functional requirements

### Input, extraction, and limits

- Accept exactly PDF for slides, TXT for transcript, and Markdown (`.md`) for notes.
- Validate extension, MIME compatibility, file size, PDF signature, and UTF-8/binary safety.
- Enforce 10 MiB PDF, 1 MiB per text file, 120,000 normalized characters total, 100 chunks total, and 1,800 characters per chunk.
- Reject over-limit content instead of truncating it.
- Reject malformed, encrypted, image-only, or textless PDFs with an actionable message; OCR is out of scope.
- Extract PDF text by page, transcript text into numbered non-empty paragraphs, and notes into numbered paragraphs with active Markdown heading context.
- Recognize ATX and Setext headings only outside fenced code blocks.
- Generate structural chunk IDs and locators from parsed structure, never from fixture or provider output.

### Provider catalog and configuration

- Provider keys are optional, server-only environment variables.
- The catalog reports configured status and an allowlisted set of model IDs without exposing any credential.
- Environment defaults are:

  | Provider | Key | Model variable | Default |
  | --- | --- | --- | --- |
  | OpenAI | `OPENAI_API_KEY` | `OPENAI_MODEL` | `gpt-5.6` |
  | DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_MODEL` | `deepseek-v4-flash` |
  | Kimi | `KIMI_API_KEY` | `KIMI_MODEL` | `kimi-k3` |

- `KIMI_REGION=cn|global` selects the official China or global Kimi endpoint and defaults to `cn`; any other nonblank value fails closed before transmission.
- ChatGPT/Codex subscriptions and login tokens are not API credentials and cannot fund application API calls.

### Provider contracts

- **OpenAI:** use the Responses API, `store: false`, a bounded output budget, and Zod-derived strict Structured Outputs. Detect explicit refusal and incomplete/length failures.
- **DeepSeek:** use OpenAI-compatible Chat Completions JSON Output with thinking disabled for this extraction contract. Because JSON Output does not guarantee schema adherence and may return empty content, parse and validate locally and fail closed.
- **Kimi:** use OpenAI-compatible Chat Completions with `response_format.type=json_schema`, `strict: true`, and a bounded `max_completion_tokens` value. Parse only the final message content.
- Provider-specific request fields must remain isolated; API compatibility does not imply identical parameter support.
- The API route accepts JSON only, caps request size, enforces domain limits again on the server, applies a timeout, disables response caching, and never forwards browser-supplied credentials or endpoints.

Current official references:

- OpenAI: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
- DeepSeek: [current API models](https://api-docs.deepseek.com/) and [JSON Output](https://api-docs.deepseek.com/guides/json_mode/)
- Kimi: [regional quick start](https://platform.kimi.com/docs/overview), [model list](https://platform.kimi.ai/docs/models), and [Structured Output](https://platform.kimi.com/docs/guide/response_format)

### Domain and semantic validation

Zod schemas are the runtime and TypeScript source of truth for:

- sources: `slides`, `transcript`, `notes`;
- status: `covered`, `partial`, `missing`, `contradiction`;
- importance: `core`, `supporting`;
- chunks, provider catalog, API request/response/error envelopes, evidence references, assessments, and model analysis.

IDs must be unique. Covered assessments have no patch. Partial, missing, and contradiction require a nonblank patch. Evidence rules are:

- covered and partial: at least one slides-or-transcript reference and one notes reference;
- missing: at least one slides-or-transcript reference;
- contradiction: at least one slides-or-transcript reference and one notes reference.

All chunk references must exist. Hydrated evidence always obtains its source name, locator, heading path, and excerpt from the current chunk map. Strict structured output does not replace application-side domain and semantic validation.

### Fixture integrity

- Include the synthetic **Evidence-Based Study Strategies** files, analysis fixture, and SHA-256 fingerprint manifest.
- Pass sample assets through the production ingestion pipeline.
- Accept the fixture only when every ordered normalized source fingerprint matches.
- Label fixture results as simulated demo analysis.
- Never use the fixture for arbitrary or mismatched files or as a silent fallback for a live failure.

### Coverage and generated Markdown

Calculate coverage as:

```text
round(100 × (covered + 0.5 × partial) / all assessments)
```

Missing and contradiction contribute zero; importance does not change the formula. Zero assessments are invalid.

Generate one deterministic Markdown string from actionable assessments in missing → partial → contradiction order. Within a status, core precedes supporting with a stable final tie-break. Copy and download use the identical UTF-8 string.

### Presentation and states

- Keep **Try demo** prominent and usable without configuration.
- Provide accessible provider/model controls with configured-state labeling.
- Explain that raw files stay local and normalized chunks are transmitted only for configured live analysis.
- Distinguish local extraction, live model analysis, simulated demo analysis, and source-map-only results honestly.
- Display score, counts, filters, evidence dialogs/sheets, Markdown preview, copy feedback, and download.
- Treat initial, extracting, live-loading, success, empty, unconfigured, validation failure, textless PDF, fingerprint mismatch, provider refusal/auth/balance/rate-limit/timeout/invalid-output, retry, and reset as first-class states.
- Preserve keyboard navigation, touch targets, visible focus, semantic labels, and overlay focus restoration.

## Privacy and security

- Raw files remain in browser memory and are cleared on refresh.
- Live analysis sends normalized chunks containing source text to the selected provider; the selected provider's data-handling terms apply.
- The application does not write chunks or results to a database or persistent store.
- API keys remain server-only and must never use a `NEXT_PUBLIC_` name.
- User source text is untrusted data, not model instructions; embedded prompt injection must be ignored.
- User/provider Markdown must render without unsafe raw HTML.
- Suggested patches reject raw HTML, Markdown images, autolinks, Markdown links/references, and bare external URLs before copy or download.
- Secrets, real student records, and local `.env` files must not be committed.

## Public-deployment cost and abuse requirements

The deployment owner pays for live calls. Request-size, output, and timeout caps reduce accidental cost but do not prevent distributed abuse. A public live deployment requires an explicit operational plan for authentication or access restriction, per-user/IP rate limits, quotas, provider budget alerts or hard limits, monitoring, and an emergency disable path. Without those controls, deploy privately or omit all provider keys and expose only the no-key demo.

## Out of scope

- Authentication, accounts, user profiles, multi-user isolation, or collaboration
- Databases, saved projects, server persistence, cross-device history, or analytics
- User-supplied provider keys or arbitrary provider base URLs
- Payments or an in-app API-credit system
- Notion, audio transcription, PPTX, OCR, embeddings, vector databases, or chat

## Success criteria

Milestone 2 succeeds when:

- the judge completes the no-key sample workflow in under two minutes;
- the demo remains deterministic and makes no provider request;
- a production build passes without environment variables;
- raw files parse locally and only validated normalized chunks cross the live API boundary;
- each configured provider can produce a validated result through its documented adapter contract;
- malformed, truncated, refused, or semantically invalid provider output fails closed;
- evidence metadata comes only from freshly parsed chunks;
- score, counts, ordering, and Markdown remain deterministic across demo and live results;
- unconfigured and failed live flows preserve a useful source map and recovery action;
- there is no authentication, database, application persistence, or committed secret;
- `npm install`, `npm run lint`, `npm test`, and `npm run build` pass.
