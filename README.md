# LectureWeaver

LectureWeaver turns lecture slides, a transcript or uploaded lecture recording, and a student's existing notes into an evidence-grounded study pack. It audits coverage, rebuilds the notes into a clearer and more complete learning guide, and can create Anki-ready cards and a downloadable audio study guide. Every generated artifact remains traceable to trusted source locators.

The current release includes a deterministic no-key sample demo plus optional server-side live analysis with OpenAI, DeepSeek, or Kimi. A configured OpenAI deployment can also transcribe an uploaded recording into timestamped transcript chunks and turn the validated enhanced notes into playable, downloadable speech. The demo exercises the text-based ingestion, validation, evidence, scoring, enhanced-note, and Anki-export pipeline and never needs an API key.

## Judge path — no key, under two minutes

Once the app is open locally or on Vercel:

1. Select **Try demo**. LectureWeaver loads the checked-in PDF, transcript, and Markdown notes as real browser `File` objects.
2. Read the rebuilt guide in **Enhanced notes**, use its table of contents, then inspect any section's trusted source evidence.
3. Open **Audit trail** to review the coverage score, filter to **Missing**, and verify an issue against its page or paragraph locator.
4. Open **Anki cards**, reveal an answer, then copy or download the Anki-ready UTF-8 text file. The enhanced Markdown guide can also be copied or downloaded.

This path is deterministic, clearly labeled as simulated, and makes no analysis, transcription, or speech request even when a live provider is configured.

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
| `OPENAI_TRANSCRIBE_MODEL` | `gpt-4o-transcribe-diarize` | OpenAI model for uploaded-recording transcription and speaker-aware time segments. |
| `OPENAI_TTS_MODEL` | `gpt-4o-mini-tts` | OpenAI model for the audio study guide. |
| `DEEPSEEK_API_KEY` | — | Enables DeepSeek live analysis. |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | DeepSeek model. |
| `KIMI_API_KEY` | — | Enables Kimi live analysis. |
| `KIMI_MODEL` | `kimi-k3` | Kimi model. |
| `KIMI_REGION` | `cn` | `cn` uses `api.moonshot.cn`; `global` uses `api.moonshot.ai`. |

An invalid nonblank `KIMI_REGION` fails closed: Kimi is shown as unconfigured and no source text or key is sent to either regional endpoint.

Choose a configured provider and model before selecting the slides, notes, and either a TXT transcript or a recorded-audio file. If the analysis provider is not configured, LectureWeaver keeps the local source map and sends nothing. A failed live request also preserves the parsed source map so the user can retry, switch providers, or use the demo.

TXT transcripts are parsed locally. Recorded audio is different: after an explicit disclosure and user action, its raw bytes cross `POST /api/transcribe` and are sent to OpenAI for transcription. The returned speaker-aware time segments are validated and converted into the same trusted `transcript` chunk shape used by the existing evidence pipeline. LectureWeaver does not persist or log the audio or transcript. This release accepts completed uploads only; it does not access the microphone or perform realtime recording.

`/api/transcribe` accepts bounded multipart uploads in FLAC, MP3, MP4, MPEG, MPGA, M4A, OGG, WAV, or WebM form. The browser checks extension, MIME type, and size early; the server repeats those checks and requires the file signature to identify the same format family. OpenAI currently permits transcription uploads up to 25 MB, but this Vercel-oriented build deliberately caps the audio file at **4,000,000 bytes** and the complete multipart body at **4,250,000 bytes** to stay below Vercel's 4.5 MB Function payload limit. Larger recordings are rejected with recovery guidance; they are never silently truncated or automatically split. See the official [OpenAI transcription API reference](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create), [speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text), and [Vercel Function limits](https://vercel.com/docs/functions/limitations#request-body-size).

**Build local source map** never calls a provider. **Extract and analyze with …** is the explicit transmission action for the selected configured provider; an existing map can instead use **Analyze current source map with …** without re-extraction.

ChatGPT and Codex subscriptions do **not** fund analysis, transcription, or speech calls. OpenAI Platform API usage and the other providers' API usage require separate provider credentials and billing. Do not copy Codex login tokens or ChatGPT session credentials into this app.

## Data flow and trust boundary

```text
PDF + Markdown + (TXT transcript or recorded audio)
          │                         │
          │                         └── consent ──► /api/transcribe ──► OpenAI
          │                                                  │
          └── browser parsing              timestamped transcript chunks
                             │                            │
                             └──────── normalized source map
                                              │
                     ┌── Try demo ──► fingerprint gate ──► validated fixture
                     └── Live ──────► /api/analyze ──────► selected provider
                                              │
                               strict Zod + semantic validation
                                              │
            trusted evidence + notes/Anki ────┴──► optional OpenAI speech
```

- Raw PDF, TXT, and Markdown files are parsed in the browser and are never posted to `/api/analyze`. An uploaded recording is sent only through `POST /api/transcribe` after the interface discloses that transmission and the user explicitly starts it.
- A live request sends normalized text chunks, including their structural IDs and trusted locators. Those chunks contain source text, so users should treat live analysis as a transmission to the selected AI provider.
- Transcription segments become `transcript` chunks with validated, timestamp-based locators. Later analysis may reference their chunk IDs but cannot invent or replace the speaker, time range, filename, or excerpt.
- Provider output may supply structured assessments, enhanced-note prose, card prompts/answers, chunk IDs, and relevance. It cannot supply trusted filenames, locators, heading paths, excerpts, export tags, or source citations; those are hydrated or derived by the application.
- Provider output must pass the strict wire Zod schema, the domain schema, duplicate/reference checks, change-type rules, output-option rules, and artifact-specific evidence rules. Invalid or truncated output fails closed.
- Generated Markdown rejects raw HTML, images, autolinks, Markdown links/references, and bare external URLs before it can be copied or downloaded. Anki fields are HTML-escaped before export.
- LectureWeaver calculates the score, counts, ordering, evidence hydration, Markdown assembly, Anki tags, and Anki import text in application code. Providers do not control those values.
- `POST /api/speech` accepts JSON containing no more than 4,096 narration characters, uses a server-allowlisted voice, and returns MP3 or WAV. Speech is generated only from the validated enhanced-note study guide. Users can play or download the generated result, which is clearly disclosed as an AI-generated voice.
- The app has no authentication, database, saved history, analytics, or server persistence. Audio bytes, transcripts, and generated speech are not written to application logs or storage.

## Provider contracts

The adapters share one validated domain result but intentionally use provider-specific API contracts:

- **OpenAI:** Responses API with `store: false` and strict Structured Outputs generated from the Zod wire schema. The default `gpt-5.6` alias currently routes to GPT-5.6 Sol. Refusals and incomplete output are handled separately from valid structured results.
- **OpenAI audio:** `POST /api/transcribe` sends a validated multipart recording to the Transcriptions API with `gpt-4o-transcribe-diarize` by default and requests speaker-aware time segments. `POST /api/speech` sends at most 4,096 characters of validated enhanced-note narration to the Speech API with `gpt-4o-mini-tts` by default and returns MP3 or WAV using a server-allowlisted voice. Audio models are configured server-side and are not part of the analysis-provider picker.
- **DeepSeek:** OpenAI-compatible Chat Completions at `https://api.deepseek.com`, using JSON Output with `deepseek-v4-flash` by default. DeepSeek JSON Output guarantees parseable JSON, not schema adherence, so LectureWeaver performs strict local Zod and semantic validation.
- **Kimi:** OpenAI-compatible Chat Completions with `json_schema` and `strict: true`. `kimi-k3` is the default. The region setting selects the official China or global API base URL.

The server caps model output and request duration. A provider response that is empty, refused, content-filtered, over the output limit, malformed, or semantically invalid is never rendered as an analysis.

Official contract and model references:

- OpenAI: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol), [speech to text](https://developers.openai.com/api/docs/guides/speech-to-text), and [text to speech](https://developers.openai.com/api/docs/guides/text-to-speech)
- DeepSeek: [API quick start and current model IDs](https://api-docs.deepseek.com/) and [JSON Output](https://api-docs.deepseek.com/guides/json_mode/)
- Kimi: [quick start and regional endpoints](https://platform.kimi.com/docs/overview), [current model list](https://platform.kimi.ai/docs/models), and [Structured Output](https://platform.kimi.com/docs/guide/response_format)

## Extraction and demo integrity

- PDF.js extracts text page by page in the browser.
- TXT content becomes numbered paragraphs.
- Markdown keeps numbered paragraph locators and active ATX or Setext heading paths outside fenced code blocks.
- An uploaded completed recording may replace the TXT transcript. OpenAI transcription produces speaker-labeled segments with start/end times; LectureWeaver validates their ordering and turns them into structural transcript chunks with human-readable time locators and speaker-labeled excerpts before analysis.
- Limits are 10 MiB for PDF, 1 MiB for each text file, 4,000,000 bytes for an audio upload, 120,000 normalized characters total, 100 chunks, 1,800 characters per chunk, and 4,096 narration characters per speech request. Input is rejected rather than silently truncated.
- The sample fixture contains chunk references, not trusted display metadata.
- The fixture is accepted only when ordered normalized fingerprints match the checked-in sample manifest. Arbitrary uploads can never receive the sample result.

### Deterministic study-pack outputs

The score is calculated only in application code:

```text
round(100 × (covered + 0.5 × partial) / all assessments)
```

Missing and contradiction contribute zero. Importance affects presentation order, not arithmetic.

- **Enhanced notes:** every assessment must appear in a logically ordered section. Covered material is preserved, partial material expanded, missing material added, and contradictions corrected. Each section carries trusted evidence, and both the interface and exported Markdown include a table of contents.
- **Changes only:** actionable patches are ordered missing → partial → contradiction, with core items before supporting items.
- **Anki cards:** when requested, every core assessment must be represented. LectureWeaver creates a UTF-8 tab-separated import file with escaped Basic-card fields, deterministic tags, and trusted source locators.
- **Audio study guide:** when requested for a live result, LectureWeaver derives the narration from the validated enhanced notes, clearly labels the voice as AI-generated, and provides in-page playback and an audio download.

**Copy full notes** and **Export Markdown** use the exact same deterministic UTF-8 string; the same invariant applies to the other copy/download controls.

### Import the Anki file

1. Download **LectureWeaver Anki .txt** from the **Anki cards** view.
2. In Anki, choose **File → Import**, select the downloaded file, and use the **Basic** note type.
3. The file headers declare tab separation, HTML fields, and the tags column; choose a deck and complete the import.

LectureWeaver exports text rather than `.apkg`, so the user remains in control of the destination deck and note type. See Anki's official [text import documentation](https://docs.ankiweb.net/importing/text-files.html).

## Architecture

LectureWeaver uses the Next.js App Router, strict TypeScript, Tailwind CSS, Zod, PDF.js, the OpenAI server SDK, Vitest, and Testing Library.

```text
src/app/                 UI entry point and server analysis/audio routes
src/components/          Upload, output options, progress, study-pack views, and evidence UI
src/domain/              Zod source, API, provider, and model-analysis contracts
src/lib/extraction/      Browser validation, extraction, normalization, and chunking
src/lib/demo/            Sample loading, fingerprint verification, fixture orchestration
src/lib/ai/              Provider catalog, prompts, adapters, validation, and error mapping
src/lib/analysis/        Semantic validation, trusted hydration, score, Markdown and Anki export
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
4. For live analysis or OpenAI audio, add only the desired server-side variables from `.env.example` in the Vercel project settings, then redeploy.
5. Verify **Try demo** first, then test each configured provider and audio operation with synthetic material.

### Public-deployment cost and abuse warning

Live analysis, transcription, and speech generation spend the deployment owner's provider credits. Audio uploads also increase bandwidth and request-duration exposure. The built-in size, output, and timeout limits are safety bounds, not a complete abuse-control system. Before exposing any paid route publicly, add an appropriate combination of authentication, per-user/IP rate limiting, quotas, provider budget alerts/hard limits, monitoring, and an emergency kill switch. Until those controls exist, prefer a private or access-restricted deployment, or deploy the no-key demo without provider keys.

## Current limitations

- Slides remain limited to text-based PDFs and notes to UTF-8 Markdown. A UTF-8 TXT transcript or supported completed-audio upload supplies the lecture transcript; OCR and PPTX remain out of scope.
- Audio uses OpenAI only in this release. Recordings above 4,000,000 bytes, automatic long-recording splitting, live microphone capture, realtime transcription, in-browser recording, custom/cloned voices, and podcast-style multi-speaker generation are out of scope.
- Results are not saved and disappear on refresh.
- Anki export targets the Basic note type through a UTF-8 text import; it does not create `.apkg` packages, cloze cards, media, or schedules.
- Live analysis requires separately billed provider API access and is subject to provider availability, policy, retention terms, limits, and pricing.
- The app does not include authentication, multi-user isolation, durable rate limiting, quotas, or billing controls.
- DeepSeek JSON Output is not strict schema enforcement; every result still depends on LectureWeaver's local validation.

## Privacy

PDF, TXT, and Markdown files stay in browser memory. The no-key demo makes no model, transcription, or speech request. Live analysis sends normalized text chunks to the selected provider. When the user explicitly chooses audio transcription, the recorded-audio bytes cross the application server and are sent to OpenAI; optional speech generation sends the validated narration text to OpenAI and returns generated audio. The application does not persist or log those files, transcripts, chunks, or generated audio, but each provider's own data-handling terms still apply. Use synthetic or non-sensitive material unless the deployment and chosen provider are approved for the data involved.

## License

The source code is available under the [MIT License](./LICENSE).
