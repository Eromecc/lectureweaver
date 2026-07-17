import {
  ModelAnalysisSchema,
  SourceChunkListSchema,
  type AssessmentStatus,
  type ModelAnalysis,
  type SourceChunk,
  type SourceType,
} from "@/domain";

const PRIMARY_SOURCE_TYPES: ReadonlySet<SourceType> = new Set([
  "slides",
  "transcript",
]);

export class AnalysisSemanticError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(issues.join(" "));
    this.name = "AnalysisSemanticError";
    this.issues = issues;
  }
}

export type ValidatedAnalysis = {
  analysis: ModelAnalysis;
  chunksById: ReadonlyMap<string, SourceChunk>;
};

export function createTrustedChunkMap(
  sourceChunksInput: unknown,
): ReadonlyMap<string, SourceChunk> {
  const sourceChunks = SourceChunkListSchema.parse(sourceChunksInput);
  const chunksById = new Map<string, SourceChunk>();
  const duplicateIds: string[] = [];

  for (const chunk of sourceChunks) {
    if (chunksById.has(chunk.id)) {
      duplicateIds.push(chunk.id);
      continue;
    }
    chunksById.set(chunk.id, chunk);
  }

  if (duplicateIds.length > 0) {
    throw new AnalysisSemanticError(
      duplicateIds.map((id) => `Duplicate source chunk id: ${id}.`),
    );
  }

  return chunksById;
}

function requiredEvidenceMessage(
  status: AssessmentStatus,
  missingPrimary: boolean,
  missingNotes: boolean,
): string | undefined {
  if (status === "missing") {
    return missingPrimary
      ? "Missing assessments require evidence from slides or transcript."
      : undefined;
  }

  if (missingPrimary && missingNotes) {
    return `${status} assessments require evidence from slides or transcript and from notes.`;
  }
  if (missingPrimary) {
    return `${status} assessments require evidence from slides or transcript.`;
  }
  if (missingNotes) {
    return `${status} assessments require evidence from notes.`;
  }
  return undefined;
}

export function validateModelAnalysisAgainstChunks(
  analysisInput: unknown,
  sourceChunksInput: unknown,
): ValidatedAnalysis {
  const analysis = ModelAnalysisSchema.parse(analysisInput);
  const chunksById = createTrustedChunkMap(sourceChunksInput);
  const issues: string[] = [];

  for (const assessment of analysis.assessments) {
    const evidenceChunks: SourceChunk[] = [];

    for (const reference of assessment.evidenceRefs) {
      const chunk = chunksById.get(reference.chunkId);
      if (chunk === undefined) {
        issues.push(
          `Assessment ${assessment.id} references unknown source chunk ${reference.chunkId}.`,
        );
        continue;
      }
      evidenceChunks.push(chunk);
    }

    const hasPrimaryEvidence = evidenceChunks.some((chunk) =>
      PRIMARY_SOURCE_TYPES.has(chunk.sourceType),
    );
    const hasNotesEvidence = evidenceChunks.some(
      (chunk) => chunk.sourceType === "notes",
    );
    const message = requiredEvidenceMessage(
      assessment.status,
      !hasPrimaryEvidence,
      !hasNotesEvidence,
    );

    if (message !== undefined) {
      issues.push(`Assessment ${assessment.id}: ${message}`);
    }
  }

  if (issues.length > 0) {
    throw new AnalysisSemanticError(issues);
  }

  return { analysis, chunksById };
}
