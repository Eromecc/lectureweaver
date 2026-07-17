# LectureWeaver

LectureWeaver is a completeness-first study tool. It compares lecture slides and a transcript with a student's existing notes, classifies concepts as covered, partial, missing, or contradictory, and links every finding to trusted locators derived from the parsed sources.

This repository implements **Milestone 2: the no-key sample demo plus optional server-side live analysis with OpenAI, DeepSeek, or Kimi**. The demo remains the fastest path and never needs an API key.

## Judge path — no key, under two minutes

Once the app is open locally or on Vercel:

1. Select **Try demo**. LectureWeaver loads the checked-in PDF, transcript, and Markdown notes as real browser `File` objects.
2. Review the coverage score and category counts, then filter to **Missing**.
3. Open an issue card and inspect its source evidence and trusted page or paragraph locator.
4. In **Suggested additions**, select **Copy Markdown** or **Download .md**.

This path is deterministic, clearly labeled as simulated, and makes no model request even when a live provider is configured.

## Run locally

Prerequisites: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then use **Try demo**. No `.env` file is required for the demo or for a production build.

## Optional live analysis

To analyze user-selected material, copy the example configuration and add at least one provider key:

```bash
cp .env.example .env.local
npm run dev
```

All keys are optional and server-only. Never prefix them with `NEXT_PUBLIC_`, expose them in the browser, or commit `.env.local`.

| Variable | Default when its key is configured | Purpose |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | Enables OpenAI live analysis. |
| `OPENAI_MODEL` | `gpt-5.6` | OpenAI model; the official alias currently routes to GPT-5.6 Sol. |
| `DEEPSEEK_API_KEY` | — | Enables DeepSeek live analysis. |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | DeepSeek model. |
| `KIMI_API_KEY` | — | Enables Kimi live analysis. |
| `KIMI_MODEL` | `kimi-k3` | Kimi model. |
| `KIMI_REGION` | `cn` | `cn` uses `api.moonshot.cn`; `global` uses `api.moonshot.ai`. |

An invalid nonblank `KIMI_REGION` fails closed: Kimi is shown as unconfigured and no source text or key is sent to either regional endpoint.

Choose a configured provider and model before selecting all three source files. If the provider is not configured, LectureWeaver keeps the local source map and sends nothing. A failed live request also preserves the parsed source map so the user can retry, switch providers, or use the demo.

**Build local source map** never calls a provider. **Extract and analyze with …** is the explicit transmission action for the selected configured provider; an existing map can instead use **Analyze current source map with …** without re-extraction.

ChatGPT and Codex subscriptions do **not** fund these API calls. OpenAI Platform API usage and the other providers' API usage require separate provider credentials and billing. Do not copy Codex login tokens or ChatGPT session credentials into this app.

## Data flow and trust boundary

```text
PDF + TXT + Markdown files
          │
          ▼
browser validation, extraction, normalization, and chunking
          │
          ├── Try demo ──► fingerprint gate ──► validated fixture
          │
          └── Live ──────► normalized chunks ──► /api/analyze
                                                  │
                                  server-only selected provider
                                                  │
                                  Zod + semantic validation
                                                  │
          ◄──────── trusted evidence hydration + deterministic output
```

- Raw PDF, TXT, and Markdown files are parsed in the browser and are never posted to `/api/analyze`.
- A live request sends normalized text chunks, including their structural IDs and trusted locators. Those chunks contain source text, so users should treat live analysis as a transmission to the selected AI provider.
- Provider output may reference chunk IDs but cannot supply trusted filenames, locators, headings, or excerpts. Display evidence is hydrated from the current browser-parsed chunk map.
- Provider output must pass the strict wire Zod schema, the domain schema, duplicate/reference checks, and status-specific evidence rules. Invalid or truncated output fails closed.
- Suggested patches reject raw HTML, images, autolinks, Markdown links/references, and bare external URLs before they can be copied or downloaded.
- LectureWeaver calculates the score, counts, ordering, evidence hydration, and Markdown in application code. Providers do not control those values.
- The app has no authentication, database, saved history, analytics, or server persistence.

## Provider contracts

The adapters share one validated domain result but intentionally use provider-specific API contracts:

- **OpenAI:** Responses API with `store: false` and strict Structured Outputs generated from the Zod wire schema. The default `gpt-5.6` alias currently routes to GPT-5.6 Sol. Refusals and incomplete output are handled separately from valid structured results.
- **DeepSeek:** OpenAI-compatible Chat Completions at `https://api.deepseek.com`, using JSON Output with `deepseek-v4-flash` by default. DeepSeek JSON Output guarantees parseable JSON, not schema adherence, so LectureWeaver performs strict local Zod and semantic validation.
- **Kimi:** OpenAI-compatible Chat Completions with `json_schema` and `strict: true`. `kimi-k3` is the default. The region setting selects the official China or global API base URL.

The server caps model output and request duration. A provider response that is empty, refused, content-filtered, over the output limit, malformed, or semantically invalid is never rendered as an analysis.

Official contract and model references:

- OpenAI: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) and [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
- DeepSeek: [API quick start and current model IDs](https://api-docs.deepseek.com/) and [JSON Output](https://api-docs.deepseek.com/guides/json_mode/)
- Kimi: [quick start and regional endpoints](https://platform.kimi.com/docs/overview), [current model list](https://platform.kimi.ai/docs/models), and [Structured Output](https://platform.kimi.com/docs/guide/response_format)

## Extraction and demo integrity

- PDF.js extracts text page by page in the browser.
- TXT content becomes numbered paragraphs.
- Markdown keeps numbered paragraph locators and active ATX or Setext heading paths outside fenced code blocks.
- Limits are 10 MiB for PDF, 1 MiB for each text file, 120,000 normalized characters total, 100 chunks, and 1,800 characters per chunk. Input is rejected rather than silently truncated.
- The sample fixture contains chunk references, not trusted display metadata.
- The fixture is accepted only when ordered normalized fingerprints match the checked-in sample manifest. Arbitrary uploads can never receive the sample result.

### Coverage score

The score is calculated only in application code:

```text
round(100 × (covered + 0.5 × partial) / all assessments)
```

Missing and contradiction contribute zero. Importance affects presentation order, not arithmetic. Markdown is generated deterministically in missing → partial → contradiction order, core before supporting, and copy/download use the same UTF-8 string.

## Architecture

LectureWeaver uses the Next.js App Router, strict TypeScript, Tailwind CSS, Zod, PDF.js, the OpenAI server SDK, Vitest, and Testing Library.

```text
src/app/                 UI entry point and server API route
src/components/          Upload, provider selection, progress, results, evidence, patch UI
src/domain/              Zod source, API, provider, and model-analysis contracts
src/lib/extraction/      Browser validation, extraction, normalization, and chunking
src/lib/demo/            Sample loading, fingerprint verification, fixture orchestration
src/lib/ai/              Provider catalog, prompts, adapters, validation, and error mapping
src/lib/analysis/        Semantic validation, trusted hydration, score, Markdown generation
public/demo/             Synthetic sample assets and fingerprint manifest
fixtures/                Strictly validated simulated analysis
tests/                   Unit, integration, API, provider, and UI coverage
```

See [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) for product behavior and [AGENTS.md](./AGENTS.md) for repository conventions.

## Testing and quality gates

```bash
npm run lint
npm test
npm run build
```

The production build must pass with no provider keys. Tests use synthetic data and mocked provider responses; they must not consume paid API credits.

Before handing off the milestone, run:

```bash
npm install
npm run lint
npm test
npm run build
```

## Deploy to Vercel

1. Import this repository into Vercel and keep the **Next.js** framework preset.
2. Use `npm run build` as the build command.
3. For the no-key demo, add no environment variables.
4. For live analysis, add only the desired server-side variables from `.env.example` in the Vercel project settings, then redeploy.
5. Verify **Try demo** first, then test each configured provider with synthetic material.

### Public-deployment cost and abuse warning

`/api/analyze` spends the deployment owner's provider credits. The built-in size, output, and timeout limits are safety bounds, not a complete abuse-control system. Before exposing live analysis publicly, add an appropriate combination of authentication, per-user/IP rate limiting, quotas, provider budget alerts/hard limits, monitoring, and an emergency kill switch. Until those controls exist, prefer a private or access-restricted deployment, or deploy the no-key demo without provider keys.

## Current limitations

- Only text-based PDF slides, UTF-8 TXT transcripts, and UTF-8 Markdown notes are supported; OCR, PPTX, and audio are out of scope.
- Results are not saved and disappear on refresh.
- Live analysis requires separately billed provider API access and is subject to provider availability, policy, retention terms, limits, and pricing.
- The app does not include authentication, multi-user isolation, durable rate limiting, quotas, or billing controls.
- DeepSeek JSON Output is not strict schema enforcement; every result still depends on LectureWeaver's local validation.

## Privacy

Raw files stay in browser memory. The no-key demo makes no model request. Live analysis sends normalized text chunks to the selected provider; the application does not persist them, but the provider's own data-handling terms still apply. Use synthetic or non-sensitive material unless the deployment and chosen provider are approved for the data involved.

## License

The source code is available under the [MIT License](./LICENSE).
