# LectureWeaver Product Specification

## Product definition

**Category:** Education

**Milestone:** 1 — deployable, no-API-key sample demo

LectureWeaver helps students verify whether important information from lecture slides and transcripts has been omitted, partially covered, or contradicted in their existing notes.

LectureWeaver is not a general summarizer. Its core promise is completeness-first, evidence-linked review: every identified concept must be auditable against trusted locators produced from the user's parsed source files.

## Audience and problem

The primary user is a student who has lecture slides, a transcript, and Markdown notes but cannot quickly tell whether the notes preserve the important teaching content. Manual comparison is slow, and an ungrounded generated summary can conceal omissions or fabricate support.

The Milestone 1 demonstration must let a judge understand the value in under two minutes without configuring a service or API key.

## Product principles

1. **Completeness before condensation.** Classify coverage; do not merely rewrite the lecture.
2. **Evidence before assertion.** Every assessment resolves to freshly parsed chunks with visible page or paragraph locators.
3. **Trusted provenance.** The analysis fixture may reference chunk IDs, but it never owns source names, locators, heading paths, or excerpt text.
4. **Deterministic where possible.** Application code calculates the score, counts, ordering, evidence hydration, and Markdown output.
5. **Fail closed.** Invalid, oversized, textless, or fingerprint-mismatched input never receives a plausible-looking sample result.
6. **Local by default.** This milestone processes files in browser memory and has no API route, account, database, or persistence.

## Core user flows

### One-click sample demonstration

1. The user selects **Try demo**.
2. The browser fetches the checked-in synthetic PDF, TXT transcript, and Markdown notes and wraps them as real `File` objects.
3. The production validation, extraction, normalization, and chunking pipeline processes all three files.
4. Ordered normalized source fingerprints are compared with the checked-in manifest.
5. A strict Zod schema validates the simulated analysis fixture, then semantic rules validate its references.
6. The app hydrates trusted evidence, calculates the score and counts, and assembles the Markdown additions.
7. The user filters findings, opens evidence, and copies or downloads the generated Markdown.

### User-selected material

1. The user selects one PDF lecture, one TXT transcript, and one Markdown notes file.
2. The browser validates and parses the files locally.
3. Valid input displays a source-map summary with derived locators and heading context.
4. Because arbitrary input cannot match the sample manifest, the app does not apply the simulated fixture. It explains the mismatch and offers the included demo.
5. Replacing or resetting files clears stale derived output.

## Functional requirements

### Input and validation

- Accept exactly PDF for slides, TXT for the transcript, and Markdown (`.md`) for notes.
- Validate extension, compatible MIME type, file size, PDF signature, and UTF-8/binary safety.
- Enforce limits of 10 MiB for PDF, 1 MiB per text file, 120,000 normalized characters total, 100 chunks total, and 1,800 characters per chunk.
- Reject over-limit content instead of truncating it.
- Reject malformed, encrypted, image-only, or textless PDFs with an actionable message; OCR is out of scope.

### Extraction and source map

- Extract PDF text page by page in the browser and preserve page locators.
- Normalize the transcript into numbered non-empty paragraphs.
- Normalize notes into numbered paragraphs while preserving active Markdown heading context.
- Recognize ATX and Setext headings outside fenced code blocks.
- Generate stable structural chunk IDs and human-readable locators from parsed structure, not from fixture content.
- Normalize line endings and whitespace consistently so fingerprints and fixture references are reproducible.

### Domain and simulated analysis

The Zod-backed domain model is the single source of truth for runtime validation and TypeScript inference. It represents:

- source types: slides, transcript, notes;
- assessment statuses: covered, partial, missing, contradiction;
- importance: core or supporting;
- source chunks with identity, source metadata, locator, optional heading path, and text;
- evidence references with a chunk ID and relevance explanation;
- concept assessments with explanation, evidence, and optional patch;
- a model analysis with summary and assessments.

IDs must be unique. Covered assessments have no suggested patch. Partial, missing, and contradiction assessments require a nonblank patch. Evidence rules are:

- covered and partial: at least one slides-or-transcript reference and one notes reference;
- missing: at least one slides-or-transcript reference;
- contradiction: at least one slides-or-transcript reference and one notes reference.

All referenced chunks must exist. Hydrated display evidence always takes its source name, locator, heading path, and excerpt from the current chunk map.

### Fixture integrity

- Include a synthetic **Evidence-Based Study Strategies** PDF, transcript, notes document, analysis fixture, and SHA-256 fingerprint manifest.
- Run sample assets through the same ingestion pipeline used for user-selected files.
- Accept the fixture only when all ordered normalized source fingerprints match the manifest.
- Label fixture-derived findings as simulated demo analysis.
- Never silently fall back to the fixture for arbitrary or mismatched files.

### Coverage and generated Markdown

Calculate coverage as:

```text
round(100 × (covered + 0.5 × partial) / all assessments)
```

Missing and contradiction contribute zero. Importance does not change the formula. An empty assessment set is invalid.

Generate one deterministic Markdown string from actionable assessments:

1. missing;
2. partial;
3. contradiction;

Within each status, core assessments appear before supporting assessments, with a stable final tie-break. Copy and download must use this exact same UTF-8 string.

### Presentation and states

- Provide responsive upload cards and a prominent one-click demo action.
- Show honest extracting and analysis-preparation progress; do not imply a live model call.
- Display overall score, category counts, category filters, and issue cards.
- Let users open evidence in an accessible dialog or mobile bottom sheet with source excerpt and locator.
- Provide generated-Markdown preview, copy feedback, and `.md` download.
- Include initial, loading, validation-error, textless-PDF, fixture-mismatch, success, empty, and recoverable retry/reset states.
- Preserve keyboard navigation, visible focus, semantic labels, and focus restoration when overlays close.

## Out of scope

- Live OpenAI calls or `/api/analyze`
- Authentication, accounts, user profiles, or multi-user collaboration
- Databases, server persistence, project history, or analytics
- Notion, audio transcription, PPTX, OCR, embeddings, or vector databases
- Payments, a general-purpose chatbot, and unrelated study features

## Privacy and security

- Selected files and derived results stay in browser memory and are cleared on refresh.
- The application does not upload files or persist source material.
- No secret or environment variable is required for Milestone 1.
- Synthetic sample content is used for the checked-in demonstration; real student records must not be committed.
- Markdown rendering must not enable unsafe raw HTML.

## Success criteria

The milestone is successful when:

- a judge can complete the sample workflow and inspect grounded evidence in under two minutes;
- the sample runs end to end with no API key and no application backend;
- each displayed evidence locator and excerpt comes from freshly parsed sample chunks;
- the fingerprint gate prevents sample analysis from being applied to arbitrary uploads;
- the exact deterministic score, category counts, and generated patch are reproducible;
- copy and download controls work with the generated Markdown;
- validation and recovery states are clear on desktop and mobile;
- `npm install`, `npm run lint`, `npm test`, and `npm run build` pass;
- the app deploys to Vercel with no environment variables.

## Future boundary

A later milestone may replace the checked-in analysis fixture with a server-only OpenAI Responses API call. That work must preserve the same evidence-trust and deterministic-scoring boundaries, but it is not part of Milestone 1 and must not be preimplemented here.
