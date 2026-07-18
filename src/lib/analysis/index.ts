export {
  AnalysisSemanticError,
  createTrustedChunkMap,
  validateModelAnalysisAgainstChunks,
} from "./validate";
export type { ValidatedAnalysis } from "./validate";

export { hydrateAnalysis } from "./hydration";
export type {
  HydratedAnkiCard,
  HydratedAnalysis,
  HydratedConceptAssessment,
  HydratedEnhancedNoteSection,
  HydratedEvidence,
} from "./hydration";

export {
  calculateCoverageMetrics,
  calculateCoverageScore,
} from "./scoring";
export type { CoverageCounts, CoverageMetrics } from "./scoring";

export {
  formatTrustedEvidence,
  generateEnhancedNotesMarkdown,
  generateMarkdownPatch,
} from "./markdown";

export { generateAnkiImportText } from "./anki";

export {
  buildNarrationScripts,
  markdownToNarrationText,
} from "./narration";
export type { NarrationScript } from "./narration";

export { buildAnalysisResult } from "./result";
export type { AnalysisOrigin, AnalysisResult } from "./result";
