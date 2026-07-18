export {
  DemoAssetLoadError,
  loadDemoFiles,
  parseDemoLecturePages,
  parseDemoFixture,
  processDemoFiles,
  recoverDemoPdfExtraction,
  runFixtureAnalysis,
} from "./pipeline.client";
export type {
  DemoAnalysisResult,
  DemoPdfRecovery,
} from "./pipeline.client";

export { fingerprintSourceChunks } from "./fingerprint";
export type { DemoFingerprints } from "./fingerprint";

export {
  DemoFingerprintMismatchError,
  DemoFingerprintSetSchema,
  DemoManifestSchema,
  parseDemoManifest,
} from "./manifest";
export type { DemoManifest } from "./manifest";
