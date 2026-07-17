import type { ModelAnalysis, ProviderId, SourceChunk } from "@/domain";

import { hydrateAnalysis, type HydratedAnalysis } from "./hydration";
import { generateMarkdownPatch } from "./markdown";
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
  origin: AnalysisOrigin;
};

export function buildAnalysisResult(
  analysis: ModelAnalysis,
  chunks: SourceChunk[],
  origin: AnalysisOrigin,
): AnalysisResult {
  const hydrated = hydrateAnalysis(analysis, chunks);
  return {
    hydrated,
    metrics: calculateCoverageMetrics(hydrated.assessments),
    markdown: generateMarkdownPatch(hydrated),
    origin,
  };
}
