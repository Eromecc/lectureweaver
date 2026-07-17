# LectureWeaver

LectureWeaver is a completeness-first study tool. It compares lecture slides and a transcript with a student's existing notes, then shows what is covered, partial, missing, or contradictory. Every finding links back to a locator in the material that was actually parsed, so the review is auditable instead of being a black-box summary.

This repository currently implements **Milestone 1: a polished, browser-only sample demo**. It needs no API key, makes no OpenAI request, and has no `/api/analyze` route.

## Judge path — under two minutes

Once the app is open locally or on Vercel:

1. Select **Try demo**. LectureWeaver loads the checked-in PDF, transcript, and Markdown notes as real browser `File` objects.
2. Review the coverage score and category counts, then filter to **Missing**.
3. Open an issue card and inspect its source evidence and trusted page or paragraph locator.
4. In **Suggested additions**, select **Copy Markdown** or **Download .md**.

The demo is deterministic and does not require a network call after the app assets have loaded. Its simulated analysis is clearly labeled.

## Run locally

Prerequisites: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then use **Try demo**.

No `.env` file or API key is needed. Uploaded files and results remain in browser memory and disappear on refresh.

## How the demo works

```text
PDF + TXT + Markdown files
          │
          ▼
browser validation and text extraction
          │
          ▼
normalized chunks with trusted locators
          │
          ├── ordered source fingerprints ──► sample-manifest check
          │                                      │
          │                                      ▼
          └──────────────────────────────► validated analysis fixture
                                                 │
                                                 ▼
                               evidence hydration + deterministic score
                                                 │
                                                 ▼
                               review cards + Markdown additions
```

- PDF.js extracts text page by page in the browser.
- TXT content is normalized into numbered paragraphs.
- Markdown content keeps numbered paragraph locators and the active heading path. ATX and Setext headings are recognized outside fenced code blocks.
- Chunks are capped at 1,800 characters and receive structural IDs such as `slides:p0002:c01` or `notes:p0005-p0007:c01`.
- The sample analysis fixture contains chunk references, not trusted display metadata. Locators, source names, heading paths, and excerpts are hydrated only from the freshly parsed chunks.
- The fixture is accepted only when the ordered normalized source fingerprints match the checked-in sample manifest. Other valid files can exercise ingestion and show a source-map summary, but cannot receive the sample's simulated analysis.

### Coverage score

The score is calculated in application code, never read from the fixture:

```text
round(100 × (covered + 0.5 × partial) / all assessments)
```

Missing and contradiction assessments contribute zero. Core and supporting importance affect presentation order, not the arithmetic.

## Sample data

The synthetic **Evidence-Based Study Strategies** corpus is checked into `public/demo/`:

- `lecture.pdf` — a text-based lecture PDF
- `transcript.txt` — a paragraph-based lecture transcript
- `notes.md` — deliberately incomplete student notes
- a manifest records the expected normalized source fingerprints

The schema-valid simulated analysis lives with the project fixtures. The sample deliberately includes covered, partial, missing, and contradictory concepts so all important UI states can be demonstrated without sending material to a service.

## Architecture

LectureWeaver uses the Next.js App Router, strict TypeScript, Tailwind CSS, Zod, PDF.js, Vitest, and Testing Library. Milestone 1 has no database, authentication, server persistence, analytics, or server-side application endpoint. All parsing and analysis-fixture processing happen in the browser.

Key boundaries:

- Zod schemas are the single source of truth for domain validation and inferred TypeScript types.
- File validation checks extensions, MIME compatibility, size, PDF signature, and UTF-8 text safety.
- Input limits are 10 MiB for PDF, 1 MiB for each text file, 120,000 normalized characters in total, 100 chunks, and 1,800 characters per chunk. Input is rejected rather than silently truncated.
- Evidence references are resolved through a unique chunk map and validated against status-specific source requirements.
- Suggested Markdown is assembled in a fixed order: missing, partial, contradiction; core items precede supporting items.
- Copy and download controls use the same generated UTF-8 Markdown string.

See [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) for product behavior and [AGENTS.md](./AGENTS.md) for repository conventions and completion gates.

### GPT-5.6 integration boundary

Milestone 1 deliberately contains no OpenAI SDK, API route, model environment variable, or browser-visible secret. The checked-in fixture is validated by the same strict `ModelAnalysis` Zod contract and evidence rules that a future GPT-5.6 Structured Outputs response must satisfy. A later milestone can replace fixture loading with a server-only Responses API route while preserving trusted hydration, deterministic scoring, and patch generation; that live integration is intentionally not preimplemented here.

## Testing and quality gates

```bash
npm run lint
npm test
npm run build
```

The focused suite covers schemas and semantic rules, source normalization and chunking, Markdown heading context, deterministic scoring, trusted evidence hydration, sample fingerprint matching, patch ordering, and the one-click UI workflow.

Before calling a milestone complete, run the clean gate:

```bash
npm install
npm run lint
npm test
npm run build
```

## Deploy to Vercel

1. Import this repository into Vercel.
2. Keep the detected framework preset as **Next.js**.
3. Use `npm run build` as the build command; no environment variables are required.
4. Deploy, then run the judge path above on the production URL.

The app uses only bundled/static sample assets and browser-side processing, so the Milestone 1 deployment does not need a secret store or backend service.

## Working with Codex

- Start with [AGENTS.md](./AGENTS.md); it records the structure, commands, constraints, and definition of done for collaborators.
- Work on the current branch unless the task explicitly requests another workflow.
- Preserve the browser-only/no-key boundary for Milestone 1. Do not add an OpenAI dependency, `/api/analyze`, server persistence, or unrelated features.
- Keep schemas and domain behavior centralized rather than duplicating types in UI code.
- Add or update focused tests with behavior changes, then run lint, tests, and a production build.
- Never commit secrets, credentials, local environment files, or real student material.

## Current limitations

- Only PDF lecture slides, TXT transcripts, and Markdown notes are supported.
- PDFs must contain extractable text. Scanned/image-only, encrypted, malformed, and complex-layout PDFs may be rejected; OCR is not included.
- The checked-in fixture can analyze only the fingerprint-matched synthetic sample. Arbitrary uploads are parsed locally but do not receive simulated findings.
- There is no live GPT-5.6/OpenAI integration in this milestone. A future milestone may add a server-only Responses API route; it is intentionally absent here.
- There is no saved history, collaboration, account system, or cross-device persistence.

## Privacy

Files selected in Milestone 1 are processed locally in the browser. They are not uploaded by application code, and no application database exists. Use synthetic or non-sensitive material when testing deployments you do not control.
