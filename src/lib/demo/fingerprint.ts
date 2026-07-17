import { SourceChunkListSchema, type SourceChunk, type SourceType } from "@/domain";
import { normalizeChunkText } from "@/lib/extraction";

export type DemoFingerprints = Readonly<Record<SourceType, string>>;

const SOURCE_ORDER = ["slides", "transcript", "notes"] as const;

function canonicalSourceChunks(
  chunks: readonly SourceChunk[],
  sourceType: SourceType,
): string {
  const sourceChunks = chunks
    .filter((chunk) => chunk.sourceType === sourceType)
    .map((chunk) => [
      chunk.id,
      chunk.locator,
      chunk.headingPath ?? [],
      normalizeChunkText(chunk.text),
    ]);

  if (sourceChunks.length === 0) {
    throw new RangeError(`Cannot fingerprint an empty ${sourceType} source.`);
  }

  return JSON.stringify(sourceChunks);
}
async function sha256(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new Error("SHA-256 is unavailable in this browser.");
  }

  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * Fingerprints trusted, ordered source structure rather than raw file bytes.
 * This makes harmless PDF metadata irrelevant while binding the fixture to the
 * exact normalized chunks, locators, and Markdown heading paths it references.
 */
export async function fingerprintSourceChunks(
  sourceChunksInput: unknown,
): Promise<DemoFingerprints> {
  const chunks = SourceChunkListSchema.parse(sourceChunksInput);
  const entries = await Promise.all(
    SOURCE_ORDER.map(async (sourceType) => [
      sourceType,
      await sha256(canonicalSourceChunks(chunks, sourceType)),
    ] as const),
  );

  return Object.fromEntries(entries) as Record<SourceType, string>;
}
