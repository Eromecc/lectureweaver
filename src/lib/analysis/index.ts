export {
  AnalysisSemanticError,
  createTrustedChunkMap,
  validateModelAnalysisAgainstChunks,
} from "./validate";
export type { ValidatedAnalysis } from "./validate";

export { hydrateAnalysis } from "./hydration";
export type {
  HydratedAnalysis,
  HydratedConceptAssessment,
  HydratedEvidence,
} from "./hydration";

export {
  calculateCoverageMetrics,
  calculateCoverageScore,
} from "./scoring";
export type { CoverageCounts, CoverageMetrics } from "./scoring";

export { generateMarkdownPatch } from "./markdown";
