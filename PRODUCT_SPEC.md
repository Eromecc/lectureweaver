# LectureWeaver Product Specification

## Product definition

**Category:** Education

**Release:** evidence-grounded, one-stop study-pack workflow with optional audio transcription and narration

LectureWeaver helps students verify whether important lecture content is covered, partially covered, missing, or contradicted in their existing notes, then turns that audit into clearer expanded notes, optional Anki-ready study cards, and an optional audio study guide. An uploaded TXT file, directly pasted transcript, or completed lecture recording may supply the spoken source.

It is not a general summarizer or chatbot. Its core promise is completeness-first repair: findings, rebuilt note sections, and study cards must remain auditable through trusted locators produced from the user's parsed source files.

## Audience and milestone outcome

The primary user has a lecture source in PDF or text form, Markdown notes, and either transcript text or a completed lecture recording, but cannot quickly determine whether the notes preserve important teaching content. Manual comparison and transcription are slow, while ungrounded generation can hide omissions or fabricate support.

The release serves two entry points:

1. A judge or visitor can understand the product in under two minutes through **Try demo**, with no key, account, or model request.
2. A user may enter a temporary current-tab OpenAI, DeepSeek, or Kimi API key to analyze their own normalized source chunks without the app saving that credential. A temporary OpenAI key may additionally enable uploaded-recording transcription and study-guide speech.
3. A deployment owner may instead configure server credentials for the same provider capabilities.

## Product principles

1. **Completeness before condensation.** Audit coverage before rebuilding the notes.
2. **Evidence before assertion.** Every assessment and generated learning artifact resolves to current parsed chunks with visible locators.
3. **Trusted provenance.** Analysis models may return chunk IDs and relevance, but never own filenames, locators, heading paths, timestamps, speaker labels, or excerpts. Transcription metadata is validated at the ingestion boundary before it becomes a trusted source chunk.
4. **Repair into action.** The audit must produce a coherent learning guide, not stop at diagnosis.
5. **Deterministic where possible.** Application code calculates score, counts, ordering, evidence hydration, Markdown assembly, and Anki import formatting.
6. **Fail closed.** Invalid input or provider output never becomes a plausible-looking result.
7. **Explicit transmission boundaries.** PDF, uploaded/pasted lecture text, uploaded/pasted transcript text, and Markdown parsing stays in the browser. A recorded-audio upload crosses the server/provider boundary only after an explicit disclosure and user action; live analysis sends only normalized chunks. A temporary credential crosses the same-origin application function and is forwarded only to the selected allowlisted provider.
8. **Optional service.** No provider credential is required for the build, source-map flow, or sample demo.
9. **No hidden persistence.** The release adds no account, database, saved history, analytics, or application-level source storage.

## Core user flows

### One-click no-key demonstration

1. The user selects **Try demo**.
2. The browser loads the checked-in synthetic PDF, TXT transcript, and Markdown notes as real `File` objects.
3. The production validation, extraction, normalization, and chunking pipeline processes all three files.
4. Ordered normalized fingerprints are compared with the checked-in manifest.
5. Strict Zod and semantic rules validate the simulated fixture.
6. The app hydrates trusted evidence, calculates score/counts, builds the enhanced-note guide, and assembles deterministic Markdown and Anki text exports.
7. The user reads the enhanced notes, verifies section evidence, audits individual findings, previews cards, and copies or downloads the generated study materials.

This flow never calls analysis, transcription, or speech services, even when provider keys exist. The checked-in synthetic sources and fixture output remain intentionally English; the live output-language control never pretends to translate or regenerate the fixture.

### Live analysis of user-selected material

1. The user supplies one lecture source as a text-based PDF, uploaded UTF-8 TXT, or directly pasted text; one separately uploaded UTF-8 `.md` or `.markdown` notes file; and either an uploaded UTF-8 TXT transcript or directly pasted transcript text.
2. Lecture and transcript paste drafts are validated locally through the same production validators as uploaded TXT after a 400 ms pause; a visible validate-now action runs the same check immediately. Editing a draft invalidates its previously materialized local `File`. Neither automatic nor manual paste validation triggers a provider request. Valid pasted text then follows the same normalization, chunking, and locator contract as its uploaded TXT equivalent. A recorded-audio upload may supply the transcript through the separate flow below.
3. The user chooses a provider/model, an output language, and whether to create Anki cards. Enhanced notes are always produced. Output language is strictly one of `en`, `zh-CN`, `ja`, or `ko`; **Follow interface** resolves to the current interface locale for the next request.
4. If the selected provider has either a deployment credential or a valid temporary current-tab credential, the browser posts only the normalized chunks, selected target, resolved nonsecret output language, and nonsecret credential mode to `/api/analyze`.
5. The server resolves an allowlisted endpoint and uses exactly the declared credential path. A temporary key is carried only in a bounded same-origin request header; a missing/stripped temporary header never falls back to a deployment key. The client cannot submit an arbitrary base URL or model ID.
6. The adapter requests a structured analysis and maps provider failures to a stable application error contract.
7. The result must pass the wire Zod schema, domain Zod schema, uniqueness/reference validation, and evidence/status semantic rules.
8. The browser hydrates trusted evidence from its local chunk map and calculates deterministic score, counts, ordering, enhanced Markdown, changes-only Markdown, and Anki import text.

### Uploaded recording to timestamped transcript

1. The user chooses a completed recorded-audio file instead of a TXT transcript. Live microphone access, browser recording, and realtime transcription are not part of this release.
2. Before any upload, the interface states that the raw recording will cross the application server and be sent to OpenAI, may incur separately billed API usage, and is not persisted or logged by LectureWeaver.
3. After the user explicitly starts transcription, the browser sends a bounded multipart request to `POST /api/transcribe`. The server validates it and uses the OpenAI Transcriptions API with `gpt-4o-transcribe-diarize` by default.
4. The response must contain valid, ordered speaker segments with finite start/end times and nonblank text. Malformed or unsupported output fails closed.
5. Application code converts validated segments into structural `transcript` chunks whose locators contain trusted time ranges and whose excerpts preserve validated speaker labels. Later analysis can reference these chunk IDs but cannot replace their source metadata or excerpts.
6. The resulting source map enters the same live analysis, evidence hydration, scoring, enhanced-note, and Anki pipeline as a locally parsed TXT transcript.

### Audio study guide

1. After a validated live study pack exists, the user may request an audio study guide.
2. Application code derives bounded narration text from the validated enhanced notes; arbitrary browser-supplied model IDs or speech endpoints are rejected.
3. The browser sends at most 4,096 narration characters as JSON to `POST /api/speech`. The server calls the OpenAI Speech API using `gpt-4o-mini-tts` by default and returns MP3 or WAV from an allowlisted voice without persisting or logging the narration or audio bytes.
4. The interface clearly discloses that the voice is AI-generated and provides playback and download controls for the same generated result.
5. A failed speech request leaves the enhanced notes, audit, Markdown, and Anki outputs usable and retryable.

### Unconfigured or failed live analysis

- If the selected provider has neither a deployment key nor a valid temporary key, no chunks are sent; valid input displays a local source map and offers **Try demo**.
- The readiness UI identifies the exact missing lecture, preparing/invalid paste, missing transcript, audio transcription, missing notes, credential, model/provider selection, Kimi region, or active processing step. It explains that **Build local source map** is local-only and that **Extract and analyze with …** is the explicit normalized-text transmission action; the live action remains visible but disabled until all prerequisites are ready.
- If a provider rejects, times out, rate-limits, truncates, or returns invalid output, the source map remains available and the user can manually retry or choose another ready provider.
- Live analysis uses nested ceilings of 150 seconds for the upstream provider request, 170 seconds for the browser request, and 180 seconds for the application function. The ordering reserves cleanup and error-response headroom instead of allowing the hosting platform to terminate the outer request first.
- LectureWeaver does not automatically retry timed-out live analysis. The provider may already have performed billable work even when the application did not receive a valid result, so only an explicit user action starts another paid request.
- Replacing or resetting files clears stale analysis output.

## Functional requirements

### Input, extraction, and limits

- Accept a PDF, uploaded TXT, or directly pasted text for the lecture source; a separate Markdown (`.md` or `.markdown`) upload for notes; and uploaded TXT, directly pasted text, or a supported completed-audio upload for the transcript source.
- Validate extension, MIME compatibility, file size, PDF/audio signatures where applicable, and UTF-8/binary safety.
- Allow recorded-audio extensions/formats FLAC, MP3, MP4, MPEG, MPGA, M4A, OGG, WAV, and WebM only. The client validates extension, MIME, nonempty content, and size; the server repeats those checks and requires the detected file signature, extension, and MIME type to identify the same format family.
- Enforce 10 MiB PDF, 1 MiB per text file, 4,000,000 bytes per recorded-audio upload, 120,000 normalized characters total, 100 chunks total, 1,800 characters per chunk, and 4,096 narration characters per speech request.
- Reject over-limit content instead of truncating it.
- OpenAI currently supports transcription uploads up to 25 MB, but this deployable build intentionally uses a lower 4,000,000-byte file limit and 4,250,000-byte complete multipart-body limit to stay beneath the [Vercel Function 4.5 MB request-body limit](https://vercel.com/docs/functions/limitations#request-body-size). Automatic segmentation of longer recordings is not implemented.
- Reject malformed, encrypted, image-only, or textless PDFs with an actionable message; OCR is out of scope.
- Extract PDF text by page, lecture/transcript text into independently numbered non-empty paragraphs, and notes into numbered paragraphs with active Markdown heading context.
- Recognize ATX and Setext headings only outside fenced code blocks.
- Generate structural chunk IDs and locators from parsed structure, never from fixture or provider output.
- Output-language instructions apply only to generated human-readable prose. JSON keys, IDs, enum values, chunk references, source names, filenames, trusted locators, code, formulas, and technical identifiers remain verbatim.
- Validate audio-transcription segment ordering, timestamps, speakers, and text before producing transcript chunk IDs and time-range locators.

### Provider catalog and configuration

- Deployment provider keys are optional, server-only environment variables. Never expose them through the provider catalog or a `NEXT_PUBLIC_` variable.
- A user may alternatively enter separate temporary OpenAI, DeepSeek, or Kimi keys. LectureWeaver holds them only in current-page memory, sends the selected key in a bounded same-origin header, and does not save it to browser storage, cookies, URLs, logs, analytics, server persistence, or source/result objects.
- Temporary key inputs are masked and clearable. Reset, component teardown, and `pagehide` clear them from application state. This is an application non-persistence guarantee, not forensic erasure: the local browser/device, developer tools, extensions, the Vercel function, and the selected provider remain inside the disclosure boundary.
- Each request declares `credentialMode`. Session mode without a valid matching header and deployment mode with a temporary header fail closed. OpenAI temporary keys can enable analysis/transcription/speech; DeepSeek and Kimi temporary keys enable analysis only.
- Temporary Kimi users explicitly select `cn` or `global`; deployment Kimi continues to use `KIMI_REGION`. No request infers a temporary key's region from deployment configuration.
- The catalog reports deployment-configured status and an allowlisted set of model IDs without exposing any credential.
- Environment defaults are:

  | Provider | Key | Model variable | Default |
  | --- | --- | --- | --- |
  | OpenAI | `OPENAI_API_KEY` | `OPENAI_MODEL` | `gpt-5.6` |
  | OpenAI transcription | `OPENAI_API_KEY` | `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-transcribe-diarize` |
  | OpenAI speech | `OPENAI_API_KEY` | `OPENAI_TTS_MODEL` | `gpt-4o-mini-tts` |
  | DeepSeek | `DEEPSEEK_API_KEY` | `DEEPSEEK_MODEL` | `deepseek-v4-flash` |
  | Kimi | `KIMI_API_KEY` | `KIMI_MODEL` | `kimi-k3` |

- `KIMI_REGION=cn|global` selects the official China or global Kimi endpoint and defaults to `cn`; any other nonblank value fails closed before transmission.
- ChatGPT/Codex subscriptions and login tokens are not API credentials and cannot fund application analysis, transcription, or speech calls.

### Provider contracts

- **OpenAI:** use the Responses API, `store: false`, a bounded output budget, and Zod-derived strict Structured Outputs. Detect explicit refusal and incomplete/length failures.
- **OpenAI transcription:** `POST /api/transcribe` accepts multipart data containing one validated recording of at most 4,000,000 bytes, with a 4,250,000-byte cap on the complete request body. Use the Transcriptions API with `gpt-4o-transcribe-diarize`, `diarized_json`, and provider-side automatic chunking by default. Validate every returned segment before it becomes source-map data.
- **OpenAI speech:** `POST /api/speech` accepts validated JSON with at most 4,096 narration characters. Use the Speech API with `gpt-4o-mini-tts` by default, a server-allowlisted voice, MP3 or WAV output, and a provider timeout. Clearly disclose that output is AI-generated.
- **DeepSeek:** use OpenAI-compatible Chat Completions JSON Output with thinking disabled for this extraction contract. Because JSON Output does not guarantee schema adherence and may return empty content, parse and validate locally and fail closed.
- **Kimi:** use OpenAI-compatible Chat Completions with `response_format.type=json_schema`, `strict: true`, and a bounded `max_completion_tokens` value. Parse only the final message content.
- Provider-specific request fields must remain isolated; API compatibility does not imply identical parameter support.
- `/api/analyze` and `/api/speech` accept validated JSON; `/api/transcribe` accepts only the bounded multipart audio contract. Every server route applies content/size validation, timeouts, response-cache disabling, allowlisted targets/endpoints, explicit credential-mode checks, and secret-safe error mapping. For live analysis, the provider/browser/function timeout layers are 150/170/180 seconds respectively; audio routes retain their separate bounded provider contracts.

Current official references:

- OpenAI: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol), [transcription API reference](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create), [speech to text](https://developers.openai.com/api/docs/guides/speech-to-text), and [text to speech](https://developers.openai.com/api/docs/guides/text-to-speech)
- DeepSeek: [current API models](https://api-docs.deepseek.com/) and [JSON Output](https://api-docs.deepseek.com/guides/json_mode/)
- Kimi: [regional quick start](https://platform.kimi.com/docs/overview), [model list](https://platform.kimi.ai/docs/models), and [Structured Output](https://platform.kimi.com/docs/guide/response_format)

### Domain and semantic validation

Zod schemas are the runtime and TypeScript source of truth for:

- sources: `slides`, `transcript`, `notes`;
- status: `covered`, `partial`, `missing`, `contradiction`;
- importance: `core`, `supporting`;
- chunks, provider catalog, output-language selection, API request/response/error envelopes, transcription segments/results, speech requests, evidence references, assessments, enhanced-note sections, Anki cards, and model analysis.

IDs must be unique. Covered assessments have no patch. Partial, missing, and contradiction require a nonblank patch. Evidence rules are:

- covered and partial: at least one slides-or-transcript reference and one notes reference;
- missing: at least one slides-or-transcript reference;
- contradiction: at least one slides-or-transcript reference and one notes reference.

All chunk references must exist. Hydrated evidence always obtains its source name, locator, heading path, and excerpt from the current chunk map. Strict structured output does not replace application-side domain and semantic validation.

Enhanced-note rules are:

- every assessment must appear in at least one enhanced-note section;
- `covered`, `partial`, `missing`, and `contradiction` map exactly to `preserved`, `expanded`, `new`, and `corrected` sections;
- every section requires lecture evidence, while preserved, expanded, and corrected sections also require notes evidence;
- artifact evidence must be a subset of the linked assessments' validated evidence and must overlap each linked assessment.

When Anki output is requested, at least one card and coverage of every core assessment are required. Each card requires lecture evidence. When it is not requested, the card array must be empty. Card fronts must be unique after whitespace/case normalization.

### Fixture integrity

- Include the synthetic **Evidence-Based Study Strategies** files, analysis fixture, and SHA-256 fingerprint manifest.
- Pass sample assets through the production ingestion pipeline.
- Accept the fixture only when every ordered normalized source fingerprint matches.
- Label fixture results as simulated demo analysis and identify the included study-pack fixture as English regardless of the live output-language selection.
- Never use the fixture for arbitrary or mismatched files or as a silent fallback for a live failure.

### Coverage and generated study materials

Calculate coverage as:

```text
round(100 × (covered + 0.5 × partial) / all assessments)
```

Missing and contradiction contribute zero; importance does not change the formula. Zero assessments are invalid.

Generate a deterministic complete-note Markdown string from the validated enhanced-note sections, including a numbered table of contents and numbered section headings. Generate a separate changes-only Markdown string from actionable assessments in missing → partial → contradiction order; within a status, core precedes supporting with a stable final tie-break.

When requested, generate an Anki-compatible UTF-8 tab-separated text file for the Basic note type. Quote every field, escape all model text before placing it in HTML-enabled fields, derive tags from validated importance/status values, append trusted source locators, and end the file with a line feed. Copy and download use identical strings.

When speech is requested for a live result, derive narration from the validated enhanced notes and send only that bounded narration to the configured OpenAI Speech API. Playback and download must use the returned audio result, and the interface must clearly identify it as AI-generated.

### Presentation and states

- Keep **Try demo** prominent and usable without configuration.
- Provide accessible provider/model controls with deployment-configured, temporary-key-ready, and local-only labeling, plus masked/clearable key inputs and explicit Kimi region selection. Keep local and live actions visible, distinguish their transmission boundaries, and disable them with an accessible, exact readiness reason until their respective prerequisites are satisfied.
- Provide complete English, Simplified Chinese, Japanese, and Korean interface catalogs. Provide an independent live output-language selector for `en`, `zh-CN`, `ja`, and `ko`, defaulting to **Follow interface**. Changing it affects the next live analysis and never retroactively translates an existing result.
- Preserve source text, provider/model IDs, filenames, chunk references, and evidence locators verbatim even when generated explanations and study content use another selected language.
- Explain that PDF/TXT/Markdown plus pasted lecture and transcript text stay local, while recorded-audio bytes are transmitted to OpenAI only after explicit disclosure and confirmation; normalized chunks are transmitted only for explicitly requested live analysis.
- Distinguish local extraction, audio upload/transcription, live model analysis, speech generation, simulated demo analysis, and source-map-only results honestly.
- Display score, counts, enhanced notes with a jump-link table of contents, audit filters, changes-only Markdown, Anki previews, audio playback/download, evidence dialogs/sheets, copy feedback, and downloads.
- Treat initial, extracting, transcribing, live-loading, generating-speech, success, empty, unconfigured, validation failure, textless PDF, invalid audio, fingerprint mismatch, provider refusal/auth/balance/rate-limit/timeout/invalid-output, retry, and reset as first-class states.
- Preserve keyboard navigation, touch targets, visible focus, semantic labels, and overlay focus restoration.

## Privacy and security

- Raw PDF, uploaded/pasted lecture or transcript text, and Markdown remain in browser memory and are cleared on refresh.
- After explicit disclosure and user action, raw recorded-audio bytes cross the application server and are sent to OpenAI for transcription. They are held only for the active request and are not persisted or logged by the application.
- Live analysis sends normalized chunks containing source text to the selected provider; the selected provider's data-handling terms apply.
- Optional speech generation sends validated enhanced-note narration to OpenAI and returns generated audio. The interface must identify the voice as AI-generated.
- The application does not write audio, transcripts, generated speech, chunks, or results to a database, persistent store, or application log.
- Deployment API keys remain server-only and must never use a `NEXT_PUBLIC_` name. Temporary keys use only the bounded current-tab/header path above and are never persisted by LectureWeaver.
- A live-analysis timeout does not change credential handling: the temporary key remains current-tab/request-scoped and is not persisted for retry. An explicit retry may send only the key still held in current page memory; it is never recovered from browser or server storage.
- User source text is untrusted data, not model instructions; embedded prompt injection must be ignored.
- User/provider Markdown must render without unsafe raw HTML.
- Generated Markdown rejects raw HTML, Markdown images, autolinks, Markdown links/references, and bare external URLs before copy or download. Anki fields are HTML-escaped during deterministic export.
- Secrets, real student records, and local `.env` files must not be committed.

## Public-deployment cost and abuse requirements

Deployment-key requests spend the deployment owner's credits; temporary-key requests spend the user's provider account. ChatGPT/Codex subscriptions do not cover either API path. Audio also increases bandwidth and request-duration exposure. Request-size, output, and timeout caps reduce accidental cost but do not prevent distributed abuse of owner-funded routes. A public deployment containing deployment keys requires an explicit operational plan for authentication or access restriction, per-user/IP rate limits, quotas, provider budget alerts or hard limits, monitoring, and an emergency disable path. Without those controls, deploy privately or expose only the no-key demo and temporary BYOK path.

## Out of scope

- Authentication, accounts, user profiles, multi-user isolation, or collaboration
- Databases, saved projects, server persistence, cross-device history, or analytics
- Arbitrary provider base URLs/model IDs, saved credential vaults, or keys stored in URLs, request bodies, browser storage, cookies, logs, or persistent server state
- Payments or an in-app API-credit system
- Notion, PPTX, OCR, embeddings, vector databases, or chat
- Recordings above 4,000,000 bytes, automatic long-recording splitting, live microphone access, in-browser recording, realtime transcription, custom/cloned voices, non-OpenAI audio providers, or podcast-style multi-speaker generation
- Anki `.apkg` generation, media cards, cloze note types, scheduling, or direct Anki synchronization

## Success criteria

The release succeeds when:

- the judge completes the no-key sample workflow in under two minutes;
- the demo remains deterministic and makes no analysis, transcription, or speech request;
- a production build passes without environment variables;
- PDF/TXT/Markdown files and pasted lecture/transcript text parse locally; a supported recording of at most 4,000,000 bytes crosses `/api/transcribe` only after explicit disclosure and becomes validated timestamped transcript chunks without silent truncation;
- each deployment-configured or temporary-key-ready provider can produce a validated result through its documented adapter contract;
- each live provider receives the resolved `en`, `zh-CN`, `ja`, or `ko` output language, while existing results and the English fixture remain unchanged when the selection changes;
- malformed, truncated, refused, or semantically invalid provider output fails closed;
- evidence metadata comes only from freshly parsed chunks;
- score, counts, ordering, trusted evidence, Markdown assembly, and Anki export remain deterministic across demo and live results;
- every result contains a coherent enhanced-note guide, and requested Anki output covers every core assessment;
- requested live audio study guides are derived from validated enhanced notes, clearly disclosed as AI-generated, playable, and downloadable;
- unconfigured and failed live flows preserve a useful source map and recovery action;
- temporary credentials clear on explicit clear/reset/page exit, mode mismatches fail closed without deployment-key fallback, and the demo never consumes them;
- there is no authentication, database, application persistence, audio/source logging, or committed secret;
- `npm install`, `npm run lint`, `npm test`, and `npm run build` pass.
