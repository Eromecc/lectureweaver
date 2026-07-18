import type {
  AnalysisOutputOptions,
  ModelAnalysis,
  ProviderId,
  SourceChunk,
} from "@/domain";

import { generateAnkiImportText } from "./anki";
import { hydrateAnalysis, type HydratedAnalysis } from "./hydration";
import {
  generateEnhancedNotesMarkdown,
  generateMarkdownPatch,
} from "./markdown";
import { calculateCoverageMetrics, type CoverageMetrics } from "./scoring";

export type AnalysisOrigin =
  | { kind: "demo" }
  | {
      kind: "live";
      provider: ProviderId;
      providerLabel: string;
      model: string;
    };

export type AnalysisResult = {
  hydrated: HydratedAnalysis;
  metrics: CoverageMetrics;
  markdown: string;
  enhancedMarkdown: string;
  ankiImportText: string;
  origin: AnalysisOrigin;
};

export function buildAnalysisResult(
  analysis: ModelAnalysis,
  chunks: SourceChunk[],
  origin: AnalysisOrigin,
  outputs?: AnalysisOutputOptions,
): AnalysisResult {
  const hydrated = hydrateAnalysis(analysis, chunks, outputs);
  return {
    hydrated,
    metrics: calculateCoverageMetrics(hydrated.assessments),
    markdown: generateMarkdownPatch(hydrated),
    enhancedMarkdown: generateEnhancedNotesMarkdown(hydrated),
    ankiImportText: generateAnkiImportText(hydrated),
    origin,
  };
}
