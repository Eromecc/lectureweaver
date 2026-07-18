// @vitest-environment node

import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { SourceChunk } from "@/domain";
import {
  DemoAssetLoadError,
  DemoFingerprintMismatchError,
  fingerprintSourceChunks,
  loadDemoFiles,
  parseDemoFixture,
  parseDemoManifest,
  runFixtureAnalysis,
} from "@/lib/demo";
import {
  assertProcessedSources,
  chunkMarkdownNotes,
  chunkPdfPages,
  chunkTranscript,
  normalizeSourceText,
  type PdfPageText,
  type ProcessedSources,
} from "@/lib/extraction";

const EXPECTED_FINGERPRINTS = {
  slides: "488daf261775c532f4f66205c68a5299e752ca179dffa59bd699b514865fcd10",
  transcript: "3c671b20d8768f369504d47ef0c6ae4db21bc74b81d18f4473592173669ad43d",
  notes: "37e3addcdf42a70f08f9e5d08770eea47551dd12ed6a8ee1e31c50c502c6317a",
} as const;

const EXPECTED_MARKDOWN_PATCH = `# Suggested note additions

## Missing concepts

### Feedback correction loop

Feedback should follow a genuine attempt soon enough to correct an error before it stabilizes. Use the loop **attempt → feedback → correction → retry**; immediate feedback often helps novices and factual errors, while a brief delay can support reflection on complex judgments.

> Evidence: lecture.pdf · Page 6; transcript.txt · Paragraphs 6-9

## Partially covered concepts

### Interleaving and discrimination

Interleaving helps learners discriminate among related problem types: each item requires noticing diagnostic features, identifying the problem category, and choosing the appropriate strategy. It can reduce immediate accuracy while improving later strategy selection and transfer.

> Evidence: lecture.pdf · Page 5; transcript.txt · Paragraphs 6-9; notes.md · Paragraph 6 — Evidence-Based Study Strategies › Desirable Difficulties › Interleaving

## Possible contradictions

### Rereading fluency versus mastery

Rereading is useful for orientation or targeted restudy, but familiarity is not evidence of mastery. Practice testing and distributed practice build more durable access; close the material and retrieve before rereading the specific gaps you expose.

> Evidence: lecture.pdf · Page 7; transcript.txt · Paragraphs 6-9; notes.md · Paragraph 7 — Evidence-Based Study Strategies › Revision Routine › Best Review Method
`;

type PdfTextItem = {
  str: string;
  hasEOL: boolean;
  transform: number[];
};

function isPdfTextItem(value: unknown): value is PdfTextItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "str" in value &&
    typeof value.str === "string" &&
    "transform" in value &&
    Array.isArray(value.transform)
  );
}

// Mirrors the browser extractor's line reconstruction while using PDF.js's
// legacy entry solely because this integration test executes in Node.
function textItemsToLines(items: unknown[]): string {
  const lines: string[] = [];
  let currentLine: string[] = [];
  let lastY: number | null = null;

  const flush = () => {
    const line = currentLine.join(" ").replace(/\s{2,}/g, " ").trim();
    currentLine = [];
    if (line) lines.push(line);
  };

  for (const item of items) {
    if (!isPdfTextItem(item) || !item.str.trim()) continue;
    const y: number = item.transform[5] ?? lastY ?? 0;
    if (lastY !== null && Math.abs(y - lastY) > 4) flush();
    currentLine.push(item.str.trim());
    lastY = y;
    if (item.hasEOL) flush();
  }
  flush();
  return normalizeSourceText(lines.join("\n"));
}

async function extractSamplePdf(pdf: Uint8Array): Promise<PdfPageText[]> {
  const loadingTask = getDocument({
    data: pdf,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  });
  const document = await loadingTask.promise;
  const pages: PdfPageText[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push({ pageNumber, text: textItemsToLines(content.items) });
    page.cleanup();
  }
  await loadingTask.destroy();
  return pages;
}

async function processCheckedInCorpus(): Promise<ProcessedSources> {
  const [pdf, transcript, notes] = await Promise.all([
    readFile("public/demo/lecture.pdf"),
    readFile("public/demo/transcript.txt", "utf8"),
    readFile("public/demo/notes.md", "utf8"),
  ]);
  const pages = await extractSamplePdf(new Uint8Array(pdf));

  return assertProcessedSources([
    ...chunkPdfPages(pages, "lecture.pdf"),
    ...chunkTranscript(transcript, "transcript.txt"),
    ...chunkMarkdownNotes(notes, "notes.md"),
  ]);
}

let checkedInCorpus: ProcessedSources;

beforeAll(async () => {
  checkedInCorpus = await processCheckedInCorpus();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checked-in demo contract", () => {
  it("strictly validates the fixture and SHA-256 manifest", () => {
    const fixture = parseDemoFixture();
    const manifest = parseDemoManifest();

    expect(fixture.assessments).toHaveLength(7);
    expect(fixture.enhancedNotes.sections).toHaveLength(6);
    expect(fixture.ankiCards).toHaveLength(7);
    expect(manifest.fingerprints).toEqual(EXPECTED_FINGERPRINTS);
    expect(() => parseDemoManifest({ ...manifest, unexpected: true })).toThrow();
    expect(() =>
      parseDemoFixture({
        ...fixture,
        summary: "Malformed covered item",
        assessments: [
          {
            ...fixture.assessments[0],
            suggestedPatch: "Covered items cannot have a patch.",
          },
        ],
      }),
    ).toThrow();
  });

  it("runs the real checked-in corpus through fingerprints, hydration, score, and patch", async () => {
    expect(checkedInCorpus.counts).toEqual({
      slides: 8,
      transcript: 3,
      notes: 8,
    });

    const result = await runFixtureAnalysis(checkedInCorpus);
    expect(result.fingerprints).toEqual(EXPECTED_FINGERPRINTS);
    expect(result.metrics).toEqual({
      score: 64,
      total: 7,
      counts: {
        covered: 4,
        partial: 1,
        missing: 1,
        contradiction: 1,
      },
    });

    const retrieval = result.hydrated.assessments.find(
      (assessment) => assessment.id === "concept-retrieval-practice",
    );
    expect(retrieval?.evidence[0]?.chunk).toMatchObject({
      id: "slides:p0002:c01",
      sourceName: "lecture.pdf",
      locator: "Page 2",
    });
    expect(result.hydrated.assessments.flatMap((item) => item.evidence)).toHaveLength(20);
    expect(result.hydrated.enhancedNotes.sections).toHaveLength(6);
    expect(result.hydrated.ankiCards).toHaveLength(7);
    expect(result.enhancedMarkdown).toContain(
      "# Evidence-Based Study Strategies",
    );
    expect(result.enhancedMarkdown).toContain(
      "## 5. Feedback: close the correction loop",
    );
    expect(result.ankiImportText).toContain("#separator:tab");
    expect(result.ankiImportText).toContain(
      "What mechanism makes interleaving useful?",
    );

    expect(result.markdown).toContain("# Suggested note additions");
    expect(result.markdown.indexOf("## Missing concepts")).toBeLessThan(
      result.markdown.indexOf("## Partially covered concepts"),
    );
    expect(result.markdown.indexOf("## Partially covered concepts")).toBeLessThan(
      result.markdown.indexOf("## Possible contradictions"),
    );
    expect(result.markdown).toBe(EXPECTED_MARKDOWN_PATCH);
  });

  it("honors the optional Anki output without changing the audit or enhanced notes", async () => {
    const result = await runFixtureAnalysis(checkedInCorpus, {
      ankiCards: false,
    });

    expect(result.metrics.score).toBe(64);
    expect(result.hydrated.ankiCards).toEqual([]);
    expect(result.enhancedMarkdown).toContain(
      "# Evidence-Based Study Strategies",
    );
    expect(result.ankiImportText).toBe(
      "#separator:tab\n#html:true\n#columns:Front\tBack\tTags\n#tags column:3\n",
    );
  });

  it("fails closed when one normalized source differs", async () => {
    const tamperedChunks = checkedInCorpus.chunks.map((chunk): SourceChunk =>
      chunk.id === "notes:p0002:c01"
        ? { ...chunk, text: `${chunk.text} Changed.` }
        : chunk,
    );
    const tampered = assertProcessedSources(tamperedChunks);

    const failure = runFixtureAnalysis(tampered);
    await expect(failure).rejects.toBeInstanceOf(DemoFingerprintMismatchError);
    await expect(failure).rejects.toMatchObject({
      mismatchedSources: ["notes"],
      expected: EXPECTED_FINGERPRINTS,
    });
  });

  it("fingerprints ordered normalized structure deterministically", async () => {
    await expect(fingerprintSourceChunks(checkedInCorpus.chunks)).resolves.toEqual(
      EXPECTED_FINGERPRINTS,
    );

    const reordered = [
      checkedInCorpus.chunks[1],
      checkedInCorpus.chunks[0],
      ...checkedInCorpus.chunks.slice(2),
    ].filter((chunk): chunk is SourceChunk => chunk !== undefined);
    const reorderedFingerprints = await fingerprintSourceChunks(reordered);
    expect(reorderedFingerprints.slides).not.toBe(EXPECTED_FINGERPRINTS.slides);
    expect(reorderedFingerprints.transcript).toBe(EXPECTED_FINGERPRINTS.transcript);
    expect(reorderedFingerprints.notes).toBe(EXPECTED_FINGERPRINTS.notes);
  });
});

describe("demo asset loading", () => {
  it("fetches all sample assets and returns real typed File objects", async () => {
    const bodies: Record<string, string> = {
      "/demo/lecture.pdf": "%PDF-synthetic",
      "/demo/transcript.txt": "Transcript",
      "/demo/notes.md": "# Notes",
    };
    const fetchMock = vi.fn(async (input: string | URL | Request) =>
      new Response(bodies[String(input)], { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const files = await loadDemoFiles();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(files.slides).toMatchObject({
      name: "lecture.pdf",
      type: "application/pdf",
    });
    expect(files.transcript).toMatchObject({
      name: "transcript.txt",
      type: "text/plain",
    });
    expect(files.notes).toMatchObject({ name: "notes.md", type: "text/markdown" });
    expect(files.slides).toBeInstanceOf(File);
  });

  it("surfaces a typed retryable asset error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
    await expect(loadDemoFiles()).rejects.toBeInstanceOf(DemoAssetLoadError);
  });
});
