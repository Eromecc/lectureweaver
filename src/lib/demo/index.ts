export {
  DemoAssetLoadError,
  loadDemoFiles,
  parseDemoFixture,
  processDemoFiles,
  runFixtureAnalysis,
} from "./pipeline.client";
export type { DemoAnalysisResult } from "./pipeline.client";

export { fingerprintSourceChunks } from "./fingerprint";
export type { DemoFingerprints } from "./fingerprint";

export {
  DemoFingerprintMismatchError,
  DemoFingerprintSetSchema,
  DemoManifestSchema,
  parseDemoManifest,
} from "./manifest";
export type { DemoManifest } from "./manifest";
