import { ModelAnalysisSchema, type SourceType } from "@/domain";
import {
  buildAnalysisResult,
  type AnalysisResult,
} from "@/lib/analysis";
import {
  processSourceFiles,
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

export function parseDemoFixture(input: unknown = fixtureJson) {
  return ModelAnalysisSchema.parse(input);
}

export type DemoAnalysisResult = AnalysisResult & {
  fingerprints: DemoFingerprints;
};

export async function runFixtureAnalysis(
  processed: ProcessedSources,
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

  const result = buildAnalysisResult(
    parseDemoFixture(),
    processed.chunks,
    { kind: "demo" },
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
  const processed = await processSourceFiles(await loadDemoFiles());
  return { processed, analysis: await runFixtureAnalysis(processed) };
}
