# LectureWeaver

LectureWeaver turns a lecture source (PDF, uploaded TXT, or pasted text), an uploaded or pasted transcript (or uploaded lecture recording), and a student's existing notes into an evidence-grounded study pack. It audits coverage, rebuilds the notes into a clearer and more complete learning guide, and can create Anki-ready cards and a downloadable audio study guide. Every generated artifact remains traceable to trusted page, paragraph, or time-range locators.

The current release includes a deterministic no-key sample demo plus optional live analysis with OpenAI, DeepSeek, or Kimi. Live requests can use either a deployment-managed key or a temporary key entered for the current browser tab; OpenAI can also transcribe an uploaded recording into timestamped transcript chunks and turn validated enhanced notes into playable, downloadable speech. The interface is available in English, Simplified Chinese, Japanese, and Korean, and live study-pack output can use the same four languages. The demo exercises the text-based ingestion, validation, evidence, scoring, enhanced-note, and Anki-export pipeline and never needs an API key.

## Judge path — no key, under two minutes

Once the app is open locally or on Vercel:

1. Select **Try demo**. LectureWeaver loads the checked-in PDF, transcript, and Markdown notes as real browser `File` objects.
2. Read the rebuilt guide in **Enhanced notes**, use its table of contents, then inspect any section's trusted source evidence.
3. Open **Audit trail** to review the coverage score, filter to **Missing**, and verify an issue against its page or paragraph locator.
4. Open **Anki cards**, reveal an answer, then copy or download the Anki-ready UTF-8 text file. The enhanced Markdown guide can also be copied or downloaded.

This path is deterministic, clearly labeled as simulated, and makes no analysis, transcription, or speech request even when a live provider is configured. Its checked-in synthetic sources and fixture output are intentionally English; changing the live output-language selector does not translate or regenerate the fixture.

## Run locally

Prerequisites: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), then use **Try demo**. No `.env` file is required for the demo or for a production build.

## Optional live analysis and API keys

The simplest personal path is the in-app **Temporary API key** panel. Choose OpenAI, DeepSeek, or Kimi, paste that provider's API key into its masked field, then run live analysis. The key is held only in this page's memory and is cleared when you clear/reset the app, close/reload the tab, or leave the page. LectureWeaver does not put it in browser storage, cookies, URLs, source/result data, logs, analytics, or a database.

The **Study pack outputs** panel lets a live request produce human-readable analysis and study content in English (`en`), Simplified Chinese (`zh-CN`), Japanese (`ja`), or Korean (`ko`). The default **Follow interface** option resolves to the current interface language; an explicit choice remains independent of later interface changes. The selection applies to the next live analysis only. Existing results are not automatically translated, and the included fixture demo remains its honest English sample. Machine-controlled values—including IDs, enum values, chunk references, source names, filenames, page/paragraph/time locators, code, formulas, and technical identifiers—remain verbatim in every language.

This is not a “never leaves your browser” design: the temporary key crosses the same-origin HTTPS Vercel function in a secret request header and is forwarded only to the selected allowlisted provider. It remains visible to your local browser/device, developer tools, and potentially browser extensions; the Vercel function and provider are also within the trust boundary. Prefer a non-production/restricted provider key with a small budget, and revoke it if the device is not trusted. Temporary OpenAI keys enable OpenAI analysis, transcription, and speech; DeepSeek and Kimi keys enable analysis only. Kimi also requires an explicit China (`cn`) or global region choice.

For a private or controlled deployment, server-side environment configuration remains the recommended operational setup:

To analyze user-selected material, copy the example configuration and add at least one provider key:

```bash
cp .env.example .env.local
npm run dev
```

All environment keys are optional and server-only. Never prefix them with `NEXT_PUBLIC_`, expose them through application props/catalog data, or commit `.env.local`.

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

Choose a provider/model and supply either its temporary key or deployment configuration before selecting a PDF/TXT lecture source or pasting lecture text, uploading notes as a separate `.md` or `.markdown` file, and supplying an uploaded/pasted transcript or recorded-audio file. A failed live request preserves the parsed source map so the user can retry, switch providers, or use the demo.

Lecture and transcript paste drafts are validated locally after a 400 ms pause through the same production UTF-8 validators used for uploaded TXT files; **Validate … now** runs that validation immediately. Editing a draft invalidates its previously materialized local `File`, so analysis cannot use stale text. Automatic and manual paste validation make no provider request. Once valid, pasted text enters the same normalization, chunking, and locator pipeline as its uploaded TXT equivalent. Notes are not a paste field and still require a separate `.md` or `.markdown` upload.

Recorded audio is different: after an explicit disclosure and user action, its raw bytes cross `POST /api/transcribe` and are sent to OpenAI for transcription. The returned speaker-aware time segments are validated and converted into the same trusted `transcript` chunk shape used by the existing evidence pipeline. LectureWeaver does not persist or log the audio or transcript. This release accepts completed uploads only; it does not access the microphone or perform realtime recording.

`/api/transcribe` accepts bounded multipart uploads in FLAC, MP3, MP4, MPEG, MPGA, M4A, OGG, WAV, or WebM form. The browser checks extension, MIME type, and size early; the server repeats those checks and requires the file signature to identify the same format family. OpenAI currently permits transcription uploads up to 25 MB, but this Vercel-oriented build deliberately caps the audio file at **4,000,000 bytes** and the complete multipart body at **4,250,000 bytes** to stay below Vercel's 4.5 MB Function payload limit. Larger recordings are rejected with recovery guidance; they are never silently truncated or automatically split. See the official [OpenAI transcription API reference](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create), [speech-to-text guide](https://developers.openai.com/api/docs/guides/speech-to-text), and [Vercel Function limits](https://vercel.com/docs/functions/limitations#request-body-size).

The readiness text names the exact missing lecture, unvalidated/invalid paste, missing transcript or audio transcription, missing notes, credential, region, or in-progress step. **Build local source map** uses only ready local sources and never calls a provider. **Extract and analyze with …** is the explicit normalized-text transmission action for the selected ready provider; it stays visible but disabled until both sources and provider prerequisites are ready. An existing map can instead use **Analyze current source map with …** without re-extraction.

Live analysis has three ordered timeout ceilings: the upstream provider request is bounded at 150 seconds, the browser request at 170 seconds, and the Vercel function at 180 seconds. The gaps leave time to cancel upstream work and return a validated error before the outer layer expires. A timeout keeps the local source map available, so the user can retry the same map or choose another ready provider without parsing the files again. LectureWeaver never retries a paid model request automatically because an interrupted request may still have consumed provider resources; every retry is a deliberate user action and may incur a new charge.

ChatGPT and Codex subscriptions do **not** fund analysis, transcription, or speech calls. OpenAI Platform API usage and the other providers' API usage require separate provider credentials and billing. Do not copy Codex login tokens or ChatGPT session credentials into this app, and never send an API key to another person in chat.

## Data flow and trust boundary

```text
(PDF/TXT/pasted lecture text) + Markdown + (uploaded/pasted transcript or recorded audio)
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

- Raw PDF, uploaded/pasted lecture text, uploaded/pasted transcript text, and Markdown are parsed in the browser and are never posted as files to `/api/analyze`. An uploaded recording is sent only through `POST /api/transcribe` after the interface discloses that transmission and the user explicitly starts it.
- A live request sends normalized text chunks, including their structural IDs and trusted locators, plus the allowlisted output-language selection. Those chunks contain source text, so users should treat live analysis as a transmission to the selected AI provider.
- Transcription segments become `transcript` chunks with validated, timestamp-based locators. Later analysis may reference their chunk IDs but cannot invent or replace the speaker, time range, filename, or excerpt.
- Provider output may supply structured assessments, enhanced-note prose, card prompts/answers, chunk IDs, and relevance in the requested human language. It cannot supply trusted filenames, locators, heading paths, excerpts, export tags, or source citations; those are hydrated or derived by the application and remain verbatim.
- Provider output must pass the strict wire Zod schema, the domain schema, duplicate/reference checks, change-type rules, output-option rules, and artifact-specific evidence rules. Invalid or truncated output fails closed.
- Generated Markdown rejects raw HTML, images, autolinks, Markdown links/references, and bare external URLs before it can be copied or downloaded. Anki fields are HTML-escaped before export.
- LectureWeaver calculates the score, counts, ordering, evidence hydration, Markdown assembly, Anki tags, and Anki import text in application code. Providers do not control those values.
- `POST /api/speech` accepts JSON containing no more than 4,096 narration characters, uses a server-allowlisted voice, and returns MP3 or WAV. Speech is generated only from the validated enhanced-note study guide. Users can play or download the generated result, which is clearly disclosed as an AI-generated voice.
- Each paid request declares either deployment or temporary credential mode. If a temporary credential header is missing/invalid, the server rejects the request instead of silently charging a deployment key. A header supplied in deployment mode is also rejected.
- Live-analysis timeouts are bounded independently at the provider (150 seconds), browser (170 seconds), and function (180 seconds) layers. Timeout recovery preserves the validated source map and is manual; the application does not silently repeat a potentially billable request.
- The app has no authentication, database, saved history, analytics, or server persistence. Temporary keys, audio bytes, transcripts, and generated speech are not written to application logs or storage.

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

- PDF.js extracts PDF lecture text page by page in the browser.
- Uploaded or pasted lecture text becomes numbered `slides` paragraphs with application-owned structural IDs; uploaded or pasted transcript text becomes separately numbered `transcript` paragraphs.
- Markdown keeps numbered paragraph locators and active ATX or Setext heading paths outside fenced code blocks.
- Uploaded TXT and pasted lecture text become numbered structural `slides` chunks; uploaded TXT and pasted transcript text become separately numbered structural `transcript` chunks. An uploaded completed recording may replace the transcript text; OpenAI transcription produces speaker-labeled segments with start/end times that LectureWeaver validates and turns into structural transcript chunks with human-readable time locators and speaker-labeled excerpts before analysis.
- Limits are 10 MiB for PDF, 1 MiB for each text file, 4,000,000 bytes for an audio upload, 120,000 normalized characters total, 100 chunks, 1,800 characters per chunk, and 4,096 narration characters per speech request. Input is rejected rather than silently truncated.
- The sample fixture contains chunk references, not trusted display metadata, and its synthetic study-pack prose is intentionally English.
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
4. For owner-managed live analysis or OpenAI audio, add only the desired server-side variables from `.env.example` in the Vercel project settings, then redeploy. For the user-funded temporary-key path, add no Vercel secret.
5. Verify **Try demo** first, then test each configured or temporary-key provider and audio operation with synthetic material.

### Public-deployment cost and abuse warning

Requests using deployment keys spend the deployment owner's provider credits; temporary-key requests spend the user's provider account. Audio uploads also increase bandwidth and request-duration exposure. The built-in size, output, and timeout limits are safety bounds, not a complete abuse-control system. Before exposing owner-funded routes publicly, add an appropriate combination of authentication, per-user/IP rate limiting, quotas, provider budget alerts/hard limits, monitoring, and an emergency kill switch. Until those controls exist, prefer a private/access-restricted deployment or a public build with only the no-key demo and temporary BYOK path.

## Current limitations

- The lecture source accepts a text-based PDF, uploaded UTF-8 TXT, or directly pasted UTF-8 text. Notes remain UTF-8 Markdown, while an uploaded/pasted UTF-8 transcript or supported completed-audio upload supplies spoken context. OCR and PPTX remain out of scope; an unreadable PDF can be replaced with its exported or copied text.
- Audio uses OpenAI only in this release. Recordings above 4,000,000 bytes, automatic long-recording splitting, live microphone capture, realtime transcription, in-browser recording, custom/cloned voices, and podcast-style multi-speaker generation are out of scope.
- Results are not saved and disappear on refresh.
- Anki export targets the Basic note type through a UTF-8 text import; it does not create `.apkg` packages, cloze cards, media, or schedules.
- Live analysis requires separately billed provider API access and is subject to provider availability, policy, retention terms, limits, and pricing.
- The app does not include authentication, multi-user isolation, durable rate limiting, quotas, or billing controls.
- DeepSeek JSON Output is not strict schema enforcement; every result still depends on LectureWeaver's local validation.

## Privacy

PDF, uploaded or pasted lecture/transcript text, and Markdown stay in browser memory. The no-key demo makes no model, transcription, or speech request. Live analysis sends normalized text chunks to the selected provider. A temporary API key exists only in current-page memory, crosses the LectureWeaver function in a bounded secret header, and is forwarded to that allowlisted provider; LectureWeaver does not persist it. When the user explicitly chooses audio transcription, the recorded-audio bytes cross the application server and are sent to OpenAI; optional speech generation sends the validated narration text to OpenAI and returns generated audio. The application does not persist or log those files, transcripts, chunks, temporary keys, or generated audio, but the browser/device, hosting layer, extensions, and each provider's own data-handling terms remain relevant. Use synthetic or non-sensitive material unless the deployment and chosen provider are approved for the data involved.

## License

The source code is available under the [MIT License](./LICENSE).
