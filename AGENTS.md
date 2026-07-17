# AGENTS.md

This file is the operating guide for humans and coding agents working on LectureWeaver. The current target is **Milestone 1: a deployable, browser-only, no-key sample demo**.

## Repository structure

```text
src/
  app/                 Next.js App Router entry points and global styles
  components/          Interactive upload, progress, results, evidence, and patch UI
  domain/              Strict Zod schemas and inferred core-data types
  lib/
    analysis/          Semantic validation, score, trusted evidence, and patch generation
    extraction/        Browser file validation, PDF/text parsing, normalization, chunking
    demo/              Sample loading, manifest verification, and fixture orchestration
public/demo/           Synthetic PDF, TXT, Markdown, and fingerprint manifest
fixtures/              Strictly validated simulated analysis data
tests/                 Focused unit, integration, and Testing Library coverage
README.md              Judge path, setup, architecture, deployment, and limitations
PRODUCT_SPEC.md        Product behavior and acceptance criteria
```

The exact grouping may evolve, but keep browser extraction, pure analysis logic, and presentation concerns separate. Do not duplicate domain types in components.

## Commands

```bash
npm install            # install the pinned dependency graph
npm run dev            # start the local Next.js development server
npm run lint           # run ESLint
npm test               # run Vitest/Testing Library tests
npm run build          # create the production Next.js build
```

Run lint, tests, and a production build before handing off a milestone. Do not use a formatter or lint command that rewrites unrelated files without first checking the worktree.

## Domain conventions

- Zod schemas are the single source of truth. Infer application types with `z.infer`; do not maintain parallel handwritten core-data interfaces.
- Keep TypeScript strict. Do not use `any` for core application data or broad TypeScript/ESLint suppression comments.
- Use source types `slides`, `transcript`, and `notes`; statuses `covered`, `partial`, `missing`, and `contradiction`; importance `core` and `supporting`.
- Generate structural chunk IDs and trusted locators from parsed source structure. Never read trusted source metadata from the fixture.
- Resolve evidence through a unique chunk map. Reject duplicate IDs, unknown references, invalid source combinations, and invalid patch/status combinations.
- Covered assessments have no patch. Every partial, missing, or contradiction assessment requires a nonblank patch.
- Calculate coverage only in application code:

  ```text
  round(100 × (covered + 0.5 × partial) / all assessments)
  ```

  Missing and contradiction contribute zero; importance does not alter the score.
- Generate Markdown deterministically in missing → partial → contradiction order, core before supporting. Copy and download must share the same generated string.

## Extraction and demo conventions

- Parsing happens in the browser. Dynamically load PDF.js client-side and use its bundled local worker.
- Support only text-based PDF slides, UTF-8 TXT transcripts, and UTF-8 Markdown notes.
- Preserve page locators, numbered paragraph locators, and Markdown heading paths.
- Recognize Markdown ATX and Setext headings only outside fenced code blocks.
- Enforce limits centrally: 10 MiB PDF, 1 MiB per text file, 120,000 normalized characters total, 100 total chunks, and 1,800 characters per chunk.
- Reject unsafe or oversized input; do not silently truncate content.
- Load sample assets as real `File` objects and pass them through the production ingestion pipeline.
- Validate the fixture with the domain schema and semantic rules. Apply it only after all ordered normalized source fingerprints match the checked-in manifest.
- Fail closed on a mismatch and direct the user to **Try demo**. Never make arbitrary uploads appear analyzed by the sample fixture.
- Label simulated results honestly. Loading text must not imply that GPT or another remote model is running.

## UI conventions

- Keep the primary flow usable by keyboard and touch, with semantic labels, visible focus, sufficient contrast, and focus restoration for overlays.
- Treat initial, extracting/loading, success, empty, validation failure, textless PDF, fingerprint mismatch, and retry/reset as first-class states.
- On narrow screens, avoid horizontal overflow and present evidence as an accessible sheet/dialog.
- Render user/fixture Markdown without unsafe raw HTML.
- Derive score cards, counts, filters, evidence views, and patch content from validated domain objects; do not hard-code the displayed sample result in components.

## Milestone 1 constraints

Do not add:

- OpenAI calls, an OpenAI SDK dependency, `/api/analyze`, or API-key configuration;
- authentication, accounts, databases, persistence, analytics, or payments;
- Notion, audio, PPTX, OCR, embeddings, vector search, chat, or collaboration features;
- secrets, generated credentials, real student content, or committed local environment files;
- placeholder TODO behavior in the main demo path.

No `.env` file is required. If future work introduces secrets, keep them server-only, document them, and never expose or commit them—but that future integration is outside this milestone.

## Testing expectations

Add focused regression coverage when changing behavior:

- schema parsing and semantic failures, including duplicate IDs and bad evidence/status rules;
- normalization, source ordering, structural IDs, locators, chunk boundaries, caps, Unicode, and CRLF;
- Markdown heading transitions, Setext headings, and fenced-code exclusions;
- score rounding, all statuses, and rejection of zero assessments;
- evidence hydration using trusted chunk metadata and fingerprint mismatch handling;
- deterministic patch ordering and exact copy/download content;
- one-click sample ingestion and core accessible UI interactions.

Tests must use synthetic data. Avoid snapshots that conceal meaningful domain changes.

## Safe collaboration

- Work on the current branch unless the task explicitly requests a branch or publication workflow.
- Inspect the worktree before editing; preserve unrelated user or agent changes.
- Prefer small, reviewable patches and pure helpers for normalization, scoring, evidence, and patch generation.
- Use `rg`/`rg --files` for repository discovery.
- Keep sample fixture and manifest changes synchronized with production extraction behavior and integration tests.
- Update `README.md`, `PRODUCT_SPEC.md`, and this file when behavior or constraints materially change.

## Definition of done

Milestone 1 is complete only when all of the following are true:

- `npm install` succeeds from the committed dependency files.
- `npm run lint` passes.
- `npm test` passes.
- `npm run build` passes with no API key configured.
- **Try demo** processes the checked-in files through real validation, extraction, chunking, fingerprint verification, evidence hydration, scoring, and Markdown generation.
- Trusted evidence locators and excerpts come from freshly parsed chunks.
- Manual valid files can show their source map but cannot receive a mismatched simulated analysis.
- Loading, error, empty, mismatch, retry/reset, copy, and download behavior is usable.
- The responsive app is ready for Vercel deployment without environment variables.
- The README judge path can be completed in under two minutes.
- No secrets, credentials, real student data, broad type/lint suppressions, or out-of-scope features are committed.
