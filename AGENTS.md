# AGENTS.md

This is the operating guide for humans and coding agents working on LectureWeaver. The current target is an **evidence-grounded, one-stop study-pack workflow**: preserve the deployable no-key demo and optional multi-provider analysis while accepting an uploaded or pasted transcript or an uploaded lecture recording, then producing enhanced notes, optional Anki-ready cards, and an optional audio study guide.

## Repository structure

```text
src/
  app/                 Next.js entry points, global styles, /api/analyze, /api/transcribe, /api/speech
  components/          Upload, output options, progress, study-pack views, and evidence UI
  domain/              Strict Zod domain, provider, and API contracts plus shared limits
  lib/
    ai/                Provider catalog, prompts, adapters, wire validation, error mapping
    analysis/          Semantic validation, trusted evidence, score, Markdown/Anki generation
    extraction/        Browser file validation, PDF/text parsing, audio intake, normalization, chunking
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
- An uploaded TXT transcript, pasted transcript, and validated audio transcription all become `transcript` chunks. Keep later analysis and evidence logic independent of which ingestion path produced them.
- Generate structural chunk IDs and trusted locators from parsed structure. Never trust fixture or provider output for source name, locator, heading path, or excerpt.
- Resolve evidence through a unique chunk map. Reject duplicate IDs, unknown references, invalid source combinations, invalid patch/status combinations, and zero assessments.
- Covered assessments have no patch. Partial, missing, and contradiction require a nonblank patch.
- When notes are absent, provider output may use only `missing` assessments and `new` enhanced-note sections; never invent a placeholder notes chunk or weaken notes-evidence requirements for covered, partial, or contradiction results.
- Every assessment must be represented in enhanced notes. Map covered → preserved, partial → expanded, missing → new, and contradiction → corrected.
- Enhanced-note and Anki evidence must come from linked assessment evidence. Require lecture evidence for every artifact, plus notes evidence for preserved, expanded, and corrected sections.
- When Anki output is requested, require at least one card and representation of every core assessment. When disabled, require an empty card array.
- Validate provider output through the strict wire schema, domain schema, and semantic rules before rendering it.
- Keep output language strict and explicit: live requests accept only `en`, `zh-CN`, `ja`, or `ko`. **Follow interface** is a UI preference that must be resolved before the request; an omitted request field defaults to `en` for backward compatibility.
- Apply the selected language only to generated human-readable fields. Preserve JSON keys, IDs, enum values, chunk references, source names, filenames, trusted locators, code, formulas, and technical identifiers exactly.
- Calculate coverage only in application code:

  ```text
  round(100 × (covered + 0.5 × partial) / all assessments)
  ```

- Missing and contradiction contribute zero; importance does not alter the score.
- Generate complete-note Markdown in validated section order with a deterministic numbered table of contents; generate changes-only Markdown in missing → partial → contradiction order, core before supporting. Copy and download share the same strings.
- Generate Anki text deterministically: UTF-8, tab-separated, quoted fields, HTML-escaped content, Basic-card Front/Back/Tags columns, application-derived tags and trusted locators, and a final line feed.

## Extraction and demo conventions

- Parse PDF, TXT, pasted text, and Markdown in the browser. Dynamically load PDF.js client-side and use its bundled local worker.
- Require at least one primary source: a text-based PDF, uploaded/pasted UTF-8 lecture text, uploaded/pasted UTF-8 transcript, or a supported completed-audio transcription. Existing UTF-8 Markdown notes are optional comparison material, and multiple primary sources may be combined. Pasted lecture and transcript text must enter the same validation, normalization, chunking, and locator pipeline as their TXT equivalents. Keep the internal source type `slides` for both page- and paragraph-located lecture sources. Do not add live microphone access, browser recording, or realtime transcription.
- Auto-validate lecture and transcript paste drafts locally after a 400 ms pause with the same production validators used for their uploaded TXT equivalents. Keep a manual validate-now action that runs the same validation immediately. Editing a draft must invalidate its prior materialized `File`; neither automatic nor manual paste validation may trigger a provider request. Notes remain a separate `.md` or `.markdown` upload and are never inferred from either paste field.
- Preserve page locators, numbered paragraph locators, Markdown heading paths, validated audio time-range locators, and speaker-labeled transcript excerpts.
- Recognize Markdown ATX and Setext headings only outside fenced code blocks.
- Enforce limits centrally: 10 MiB PDF, 1 MiB per text file, 4,000,000-byte audio upload, 120,000 normalized characters total, 100 chunks, 1,800 characters per chunk, and 4,096 narration characters per speech request.
- Reject unsafe or oversized input; never silently truncate it.
- Load sample assets as real `File` objects through the production ingestion path.
- Validate the fixture and apply it only after all ordered fingerprints match the manifest.
- Fail closed on a sample mismatch and direct the user to **Try demo**. Never apply the fixture to arbitrary input or after a live-analysis failure.
- **Try demo** is always fixture-only and must never issue a provider request, even when keys are configured.
- Label simulated results honestly. The included synthetic fixture and its study-pack prose remain English; do not imply that changing the live output-language selector translates or regenerates it.

## Audio boundary

- Before an audio upload begins, the UI must explicitly disclose that raw recorded-audio bytes will cross the application server and be sent to OpenAI, may incur separately billed API usage, and are not persisted or logged by LectureWeaver.
- `POST /api/transcribe` accepts multipart data with one completed recording only, in FLAC, MP3, MP4, MPEG, MPGA, M4A, OGG, WAV, or WebM form. The client checks extension, MIME type, nonempty content, and the exact 4,000,000-byte file limit; the server repeats those checks and requires the signature, extension, and MIME type to identify the same format family. It may accept the bounded temporary-key header described below, but never an arbitrary provider base URL.
- The OpenAI API currently permits files up to 25 MB, but this Vercel build deliberately caps the audio file at 4,000,000 bytes and the complete multipart request at 4,250,000 bytes so it remains below the [Vercel Function 4.5 MB payload limit](https://vercel.com/docs/functions/limitations#request-body-size). Reject longer files with actionable guidance; do not truncate or automatically split them.
- Use the OpenAI Transcriptions API with `OPENAI_TRANSCRIBE_MODEL`, defaulting to `gpt-4o-transcribe-diarize`. Request `diarized_json` speaker/time segments with provider-side automatic chunking and fail closed on malformed, unordered, overlapping, non-finite, or blank segments.
- Convert validated transcription segments into structural `transcript` chunks. Application code owns chunk IDs, source names, locator formatting, and final excerpts; the later analysis model may reference only their IDs.
- `POST /api/speech` accepts validated JSON with at most 4,096 narration characters. Generate speech only from narration derived from validated enhanced notes. Use the OpenAI Speech API with `OPENAI_TTS_MODEL`, defaulting to `gpt-4o-mini-tts`, plus server-allowlisted voices and MP3/WAV output only.
- Clearly disclose that generated speech is AI-generated. Playback and download must use the same returned audio result.
- Do not persist or log audio bytes, transcripts, narration text, or generated speech. Keep them request-scoped or in browser memory and clear them on reset/refresh.
- **Try demo** must never call transcription or speech, even when `OPENAI_API_KEY` is configured.
- Keep audio provider capability separate from the multi-provider analysis catalog. Do not imply that DeepSeek or Kimi supports the OpenAI audio contract.

## Live-analysis boundary

- Raw files and file bytes never cross `/api/analyze`. Send only the normalized, validated chunks plus the allowlisted provider/model and resolved output-language selection. `POST /api/transcribe` is the only raw-source exception.
- Normalized chunks contain source text. UI and docs must accurately state that live analysis transmits this text to the selected provider.
- Revalidate content type, body size, source types, chunks, IDs, per-chunk limits, and total limits on the server.
- The server always chooses allowlisted provider endpoints. A request uses either a deployment credential from the server environment or an explicitly declared temporary current-tab credential, never an arbitrary base URL.
- Keep deployment `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, and `KIMI_API_KEY` server-only. Never use a `NEXT_PUBLIC_` prefix or serialize deployment credentials into the provider catalog.
- Temporary credentials are an explicit opt-in BYOK path. Keep separate OpenAI, DeepSeek, and Kimi values in page memory only; never write them to `localStorage`, `sessionStorage`, cookies, URLs, logs, analytics, React server props, or persistent server state. Mask inputs, disable browser-assisted text transformations, provide clear/reset controls, and clear values on reset, unmount, and `pagehide`.
- Send a temporary credential only in the bounded `x-lectureweaver-provider-key` header on the same-origin HTTPS request. Send a nonsecret `credentialMode` in every analysis, transcription, and speech request. Session mode without a valid header and deployment mode with a header must both fail closed; never fall back to a deployment key when a temporary key is missing or stripped.
- OpenAI temporary credentials may enable OpenAI analysis, transcription, and speech. DeepSeek and Kimi temporary credentials enable analysis only. Temporary Kimi use requires an explicit `cn` or `global` choice; do not derive it from deployment configuration.
- UI and docs must state that a temporary key is visible to the user's browser/device and extensions, crosses the LectureWeaver/Vercel function, and is forwarded only to the selected allowlisted provider. Say “not persisted by LectureWeaver,” not “never leaves the browser” or “guaranteed erased.”
- ChatGPT/Codex subscription entitlements are not OpenAI Platform API credits. Do not use Codex login tokens or ChatGPT cookies as application credentials.
- Apply bounded request size, provider timeout, and model-output limits. Treat empty, refused, filtered, truncated, malformed, oversized, or semantically invalid provider output as an error.
- Do not impose an application browser deadline on live analysis. Abort the upstream provider request at 285 seconds and cap the Vercel Hobby application function at its 300-second platform ceiling, leaving time for cleanup and delivery of the typed timeout response. Do not reuse these values for transcription or speech, which keep their own audio-specific limits.
- Bound the one-shot analysis response to 8,000 output tokens without Anki and 10,000 with Anki. Prompt for a concise, merged study pack within the documented assessment, section, prose, and card targets; never lower only the token ceiling without keeping the prompt budget aligned.
- Never automatically retry a timed-out live provider request. Because the first attempt may already have consumed provider credits, preserve the source map and require an explicit user retry or provider/model change before issuing another request.
- Map expected failures to the stable API error envelope without leaking provider response bodies, keys, prompts, or internal stack traces.
- Preserve the local source map when a provider is absent or fails.
- Existing validated results are immutable with respect to later output-language changes. A new language takes effect only when the user explicitly runs another live analysis.
- Do not add authentication, a database, persistence, analytics, or logging of source content as part of this milestone.

## Provider conventions

Environment configuration:

```text
OPENAI_API_KEY       optional
OPENAI_MODEL         default gpt-5.6
OPENAI_TRANSCRIBE_MODEL default gpt-4o-transcribe-diarize
OPENAI_TTS_MODEL     default gpt-4o-mini-tts
DEEPSEEK_API_KEY     optional
DEEPSEEK_MODEL       default deepseek-v4-flash
KIMI_API_KEY         optional
KIMI_MODEL           default kimi-k3
KIMI_REGION          cn (default) or global
```

- **OpenAI:** use the Responses API, `store: false`, bounded `max_output_tokens`, and `zodTextFormat`/strict Structured Outputs. Handle explicit refusal and incomplete output, then still run domain and semantic validation. The official `gpt-5.6` alias currently routes to GPT-5.6 Sol.
- **OpenAI transcription:** use the Transcriptions API for completed recordings, with `diarized_json` and automatic chunking when the diarization model is selected. Validate all returned time/speaker/text segments before source-map construction.
- **OpenAI speech:** use the Speech API for enhanced-note narration, with bounded text, an allowlisted voice/format, timeout handling, and explicit AI-voice disclosure.
- **DeepSeek:** use `https://api.deepseek.com/chat/completions`, JSON Output, an explicit JSON instruction/schema example, bounded `max_tokens`, and strict local validation. JSON Output is not schema adherence and can occasionally return empty content. Keep DeepSeek-only fields isolated.
- **Kimi:** use Chat Completions with `json_schema`, `strict: true`, and bounded `max_completion_tokens`. `cn` maps to `https://api.moonshot.cn/v1`; `global` maps to `https://api.moonshot.ai/v1`. Parse final message content, not reasoning content.
- Treat missing/blank `KIMI_REGION` as `cn`, but fail closed on every other value outside `cn|global`; never silently route a typo to a regional endpoint.
- Do not assume OpenAI-compatible providers implement OpenAI Responses or identical Chat Completions parameters.
- Keep catalog models allowlisted. A deployment-specific environment default may be added to its provider catalog only after model-ID validation; the client must not choose arbitrary IDs outside the catalog.

Official references:

- OpenAI: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol), [transcription API reference](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create), [speech to text](https://developers.openai.com/api/docs/guides/speech-to-text), [text to speech](https://developers.openai.com/api/docs/guides/text-to-speech)
- DeepSeek: [current models/API quick start](https://api-docs.deepseek.com/), [JSON Output](https://api-docs.deepseek.com/guides/json_mode/)
- Kimi: [regional quick start](https://platform.kimi.com/docs/overview), [model list](https://platform.kimi.ai/docs/models), [Structured Output](https://platform.kimi.com/docs/guide/response_format)

## UI conventions

- Keep the primary path usable by keyboard and touch with semantic labels, visible focus, sufficient contrast, and overlay focus restoration.
- Keep **Try demo** prominent and no-key.
- Show deployment-configured, temporary-key-ready, and local-only states without revealing, fingerprinting, or showing a suffix of credentials. Support English, Simplified Chinese, Japanese, and Korean UI catalogs with identical key/placeholder coverage.
- Provide a live output-language selector for English, Simplified Chinese, Japanese, and Korean. Default it to **Follow interface**, but keep an explicit user choice independent of later interface changes. State that it applies to the next live analysis, does not auto-translate existing results, and does not change the English fixture demo.
- Keep both **Build local source map** and the live-analysis action visible throughout setup. Readiness requires one ready primary source and must name a preparing/invalid sole source, incomplete audio transcription, credential/region, or active-processing step; optional notes never block either action. Explain that the local action sends nothing to a provider and the live action explicitly transmits normalized text; disable each action until its own prerequisites are ready.
- Distinguish local extraction, audio upload/transcription, live analysis, speech generation, simulated analysis, and source-map-only states honestly.
- Treat initial, extracting, transcribing, live loading, generating speech, success, empty, validation failure, textless/unreadable PDF with lecture-text recovery, invalid audio, fingerprint mismatch, provider errors, retry, and reset as first-class states.
- On narrow screens, prevent horizontal overflow and present evidence as an accessible sheet/dialog.
- Render user, fixture, and provider Markdown without unsafe raw HTML.
- Reject raw HTML, Markdown images, autolinks, Markdown links/references, and bare external URLs in generated Markdown before export.
- Provide Enhanced notes, Audit trail, Changes only, Anki cards, and Audio guide as a coherent keyboard/touch workflow. Enhanced notes need a navigable table of contents and complete, untruncated prose. Audio needs labeled playback/download controls and AI-voice disclosure. Do not hide the audit or evidence beneath generated prose or audio.
- Derive cards, counts, filters, evidence, Markdown, Anki tags, and export content from validated domain objects.

## Release constraints

Do not add:

- authentication, accounts, databases, server persistence, saved projects, analytics, or payments;
- arbitrary provider endpoints, durable browser/server key vaults, saved credentials, or credentials in URLs/body content;
- Notion, PPTX, OCR, embeddings, vector search, chat, or collaboration;
- recordings above 4,000,000 bytes, automatic long-recording splitting, live microphone access, in-browser recording, realtime transcription, custom/cloned voices, non-OpenAI audio providers, or multi-speaker podcast generation;
- real student content, generated credentials, committed `.env` files, or source-text logging;
- a silent provider fallback that could charge a different service or mislabel result provenance;
- placeholder behavior in the demo or live-analysis path.

`.env.example` contains names and defaults only. Real values belong in untracked `.env.local` or the deployment secret store.

## Public deployment and cost safety

Requests using deployment credentials spend the deployment owner's provider credits; requests using a temporary credential spend the user-supplied provider account. ChatGPT/Codex subscription usage cannot fund either path. Audio uploads also increase bandwidth and request-duration exposure. Existing byte, token, and timeout limits do not prevent distributed abuse of owner-funded routes. Before a live deployment contains deployment keys and is public, require an explicit plan for access control or authentication, per-user/IP rate limits, quotas, provider budget alerts or hard limits, monitoring, and an emergency disable path. If those controls are not in scope, recommend a private/access-restricted deployment or a public deployment with only the no-key demo and temporary BYOK path.

## Testing expectations

Add focused regression coverage for behavior changes:

- schemas, duplicate IDs, provider catalog/target validation, strict output-language/default behavior, request limits, API error envelopes, credential-mode mismatch, no-deployment-key fallback, temporary-key isolation/clearing, and Kimi regional routing;
- normalization, ordering, locators, chunk caps, Unicode, CRLF, headings, and fenced-code exclusions;
- audio extension/MIME/signature checks for every allowlisted format, the exact 4,000,000-byte cap, disclosure gating, multipart route handling, transcription target validation, timestamp/speaker segment validation, and deterministic transcript chunk locators;
- score rounding, all statuses, zero-assessment rejection, enhanced-note mappings, Anki option semantics, evidence hydration, and deterministic Markdown/Anki exports;
- sample ingestion, fingerprint mismatch, provider-unconfigured behavior, and accessible UI interactions;
- OpenAI structured parse/refusal/length/error mapping;
- DeepSeek JSON parsing, empty/length/error cases, and Kimi strict-schema request/response handling;
- provider and function timeout boundaries (285/300 seconds), absence of an application browser deadline, authentication, balance, rate-limit, and invalid-output failures with mocked network responses;
- speech model/voice and MP3/WAV allowlists, the 4,096-character narration limit, audio response headers, playback/download state, retry, timeout, and invalid/empty audio failures.

Tests use synthetic data. Avoid snapshots that conceal meaningful domain changes. Never call a paid provider from the test suite.

## Safe collaboration

- Work on the current branch unless the task explicitly requests a branch or publication workflow.
- Inspect the worktree before editing and preserve unrelated user or agent changes.
- Prefer small, reviewable patches and pure helpers.
- Use `rg`/`rg --files` for discovery.
- Keep fixture and manifest changes synchronized with extraction behavior and integration tests.
- Update `README.md`, `PRODUCT_SPEC.md`, `AGENTS.md`, and `.env.example` when provider behavior, privacy boundaries, variables, or deployment requirements change.

## Definition of done

The release is complete only when:

- `npm install`, `npm run lint`, `npm test`, and `npm run build` pass with no provider key required;
- **Try demo** remains a complete, deterministic, no-request judge path under two minutes;
- PDF/TXT/Markdown files and pasted lecture/transcript text parse locally; lecture material or transcript alone can form a valid source map while notes remain optional; a supported recording of at most 4,000,000 bytes crosses `/api/transcribe` only after explicit disclosure and becomes validated timestamped transcript chunks without silent truncation;
- configured OpenAI, DeepSeek, and Kimi adapters follow their provider-specific contracts;
- live output language resolves to `en`, `zh-CN`, `ja`, or `ko`, applies only to a newly requested live result, and never alters trusted source identifiers, evidence locators, existing results, or the English fixture;
- all provider output passes Zod and semantic validation before trusted hydration;
- score/counts/Markdown/Anki exports remain application-computed and deterministic;
- every audit becomes evidence-grounded enhanced notes, and requested Anki output covers all core assessments;
- requested live audio study guides are derived from validated enhanced notes, clearly disclosed as AI-generated, playable, and downloadable;
- unconfigured and failed live flows preserve the source map and recovery actions;
- deployment credentials stay server-only; temporary credentials stay current-tab/request-scoped; no source content, audio, transcript, generated speech, or secret is persisted or logged by LectureWeaver;
- there is no authentication, database, history, analytics, or payment system;
- public deployment documentation includes the API-credit and abuse-control warning.
