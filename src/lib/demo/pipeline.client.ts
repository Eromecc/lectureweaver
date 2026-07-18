import {
  ModelAnalysisSchema,
  type AnalysisOutputOptions,
  type SourceType,
} from "@/domain";
import {
  buildAnalysisResult,
  type AnalysisResult,
} from "@/lib/analysis";
import {
  assertExtractedTextLimit,
  assertProcessedSources,
  chunkMarkdownNotes,
  chunkPdfPages,
  chunkTranscript,
  normalizeSourceText,
  processSourceFiles,
  readLectureTextFile,
  readNotesFile,
  readTranscriptFile,
  SourceProcessingError,
  type PdfPageText,
  type ProcessedSources,
  type SourceFiles,
} from "@/lib/extraction";

import fixtureJson from "../../../fixtures/demo-analysis.json";
import {
  fingerprintSourceChunks,
  type DemoFingerprints,
} from "./fingerprint";
import {
  DemoFingerprintMismatchError,
  parseDemoManifest,
} from "./manifest";

type DemoAsset = {
  sourceType: SourceType;
  path: string;
  name: string;
  mimeType: string;
};

const DEMO_ASSETS = [
  {
    sourceType: "slides",
    path: "/demo/lecture.pdf",
    name: "lecture.pdf",
    mimeType: "application/pdf",
  },
  {
    sourceType: "transcript",
    path: "/demo/transcript.txt",
    name: "transcript.txt",
    mimeType: "text/plain",
  },
  {
    sourceType: "notes",
    path: "/demo/notes.md",
    name: "notes.md",
    mimeType: "text/markdown",
  },
] as const satisfies readonly DemoAsset[];

const DEMO_PAGE_TEXT_ASSET = {
  sourceType: "slides",
  path: "/demo/lecture-pages.txt",
  name: "lecture-pages.txt",
  mimeType: "text/plain",
} as const satisfies DemoAsset;

const DEMO_PAGE_MARKER = /^--- LectureWeaver demo page ([1-9]\d*) ---$/gm;

const DEMO_SOURCE_TYPES = ["slides", "transcript", "notes"] as const;

export class DemoAssetLoadError extends Error {
  readonly sourceType: SourceType;

  constructor(sourceType: SourceType, message: string) {
    super(message);
    this.name = "DemoAssetLoadError";
    this.sourceType = sourceType;
  }
}

async function loadDemoAsset(asset: DemoAsset): Promise<File> {
  let response: Response;
  try {
    response = await fetch(asset.path, { cache: "no-store" });
  } catch {
    throw new DemoAssetLoadError(
      asset.sourceType,
      `Could not load the included ${asset.sourceType} sample. Please retry.`,
    );
  }

  if (!response.ok) {
    throw new DemoAssetLoadError(
      asset.sourceType,
      `Could not load the included ${asset.sourceType} sample (${response.status}). Please retry.`,
    );
  }

  return new File([await response.blob()], asset.name, {
    type: asset.mimeType,
    lastModified: 0,
  });
}

export async function loadDemoFiles(): Promise<SourceFiles> {
  const [slides, transcript, notes] = await Promise.all([
    loadDemoAsset(DEMO_ASSETS[0]),
    loadDemoAsset(DEMO_ASSETS[1]),
    loadDemoAsset(DEMO_ASSETS[2]),
  ]);
  return { slides, transcript, notes };
}

export function parseDemoLecturePages(input: string): PdfPageText[] {
  const text = input.replace(/\r\n?/g, "\n");
  const markers = Array.from(text.matchAll(DEMO_PAGE_MARKER));
  if (markers.length === 0 || text.slice(0, markers[0]?.index ?? 0).trim()) {
    throw new DemoAssetLoadError(
      "slides",
      "The included lecture page-text fallback is malformed.",
    );
  }

  return markers.map((marker, index) => {
    const pageNumber = Number(marker[1]);
    const expectedPageNumber = index + 1;
    const contentStart = (marker.index ?? 0) + marker[0].length;
    const contentEnd = markers[index + 1]?.index ?? text.length;
    const pageText = normalizeSourceText(text.slice(contentStart, contentEnd));
    if (pageNumber !== expectedPageNumber || !pageText) {
      throw new DemoAssetLoadError(
        "slides",
        "The included lecture page-text fallback has invalid page ordering or content.",
      );
    }
    return { pageNumber, text: pageText };
  });
}

export type DemoPdfRecovery = {
  files: SourceFiles;
  processed: ProcessedSources;
};

/**
 * Keeps Try demo available when a supported browser cannot start PDF.js's
 * module worker. This recovery is deliberately scoped to the checked-in sample;
 * arbitrary uploads still fail through the normal extraction pipeline.
 */
export async function recoverDemoPdfExtraction(
  error: unknown,
  files: SourceFiles,
): Promise<DemoPdfRecovery> {
  if (
    !(error instanceof SourceProcessingError) ||
    error.sourceType !== "slides" ||
    (error.code !== "invalid_pdf" && error.code !== "empty_source")
  ) {
    throw error;
  }

  const fallbackFile = await loadDemoAsset(DEMO_PAGE_TEXT_ASSET);
  const [fallbackText, transcript, notes] = await Promise.all([
    readLectureTextFile(fallbackFile),
    readTranscriptFile(files.transcript),
    readNotesFile(files.notes),
  ]);
  const pages = parseDemoLecturePages(fallbackText);
  assertExtractedTextLimit([
    ...pages.map((page) => page.text),
    transcript,
    notes,
  ]);
  const processed = assertProcessedSources([
    ...chunkPdfPages(pages, fallbackFile.name),
    ...chunkTranscript(transcript, files.transcript.name),
    ...chunkMarkdownNotes(notes, files.notes.name),
  ]);

  return {
    files: { ...files, slides: fallbackFile },
    processed,
  };
}

export function parseDemoFixture(input: unknown = fixtureJson) {
  return ModelAnalysisSchema.parse(input);
}

export type DemoAnalysisResult = AnalysisResult & {
  fingerprints: DemoFingerprints;
};

export async function runFixtureAnalysis(
  processed: ProcessedSources,
  outputs: AnalysisOutputOptions = { ankiCards: true },
): Promise<DemoAnalysisResult> {
  const [fingerprints, manifest] = await Promise.all([
    fingerprintSourceChunks(processed.chunks),
    Promise.resolve(parseDemoManifest()),
  ]);

  const mismatches = DEMO_SOURCE_TYPES.some(
    (sourceType) =>
      fingerprints[sourceType] !== manifest.fingerprints[sourceType],
  );
  if (mismatches) {
    throw new DemoFingerprintMismatchError(
      manifest.fingerprints,
      fingerprints,
    );
  }

  const fixture = parseDemoFixture();
  const analysis = outputs.ankiCards
    ? fixture
    : ModelAnalysisSchema.parse({ ...fixture, ankiCards: [] });
  const result = buildAnalysisResult(
    analysis,
    processed.chunks,
    { kind: "demo" },
    outputs,
  );
  return {
    ...result,
    fingerprints,
  };
}

export async function processDemoFiles(): Promise<{
  processed: ProcessedSources;
  analysis: DemoAnalysisResult;
}> {
  const files = await loadDemoFiles();
  let processed: ProcessedSources;
  try {
    processed = await processSourceFiles(files);
  } catch (error: unknown) {
    processed = (await recoverDemoPdfExtraction(error, files)).processed;
  }
  return { processed, analysis: await runFixtureAnalysis(processed) };
}
