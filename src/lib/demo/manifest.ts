import { z } from "zod";

import type { SourceType } from "@/domain";

import manifestJson from "../../../public/demo/manifest.json";
import type { DemoFingerprints } from "./fingerprint";

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

export const DemoFingerprintSetSchema = z
  .object({
    slides: sha256Hex,
    transcript: sha256Hex,
    notes: sha256Hex,
  })
  .strict();

export const DemoManifestSchema = z
  .object({
    version: z.literal(1),
    algorithm: z.literal("SHA-256"),
    normalization: z.literal("ordered-source-chunks-v1"),
    fingerprints: DemoFingerprintSetSchema,
  })
  .strict();

export type DemoManifest = z.infer<typeof DemoManifestSchema>;

export function parseDemoManifest(input: unknown = manifestJson): DemoManifest {
  return DemoManifestSchema.parse(input);
}
export class DemoFingerprintMismatchError extends Error {
  readonly expected: DemoFingerprints;
  readonly actual: DemoFingerprints;
  readonly mismatchedSources: readonly SourceType[];

  constructor(expected: DemoFingerprints, actual: DemoFingerprints) {
    const mismatchedSources = (
      ["slides", "transcript", "notes"] as const
    ).filter((sourceType) => expected[sourceType] !== actual[sourceType]);

    super(
      "These sources do not match the checked-in demo corpus, so the simulated analysis was not applied. Load Try demo to see evidence-linked results.",
    );
    this.name = "DemoFingerprintMismatchError";
    this.expected = expected;
    this.actual = actual;
    this.mismatchedSources = mismatchedSources;
  }
}
