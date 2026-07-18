import {
  ModelAnalysisSchema,
  SourceChunkListSchema,
  type AnalysisOutputOptions,
  type AssessmentStatus,
  type EvidenceRef,
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
  outputs?: AnalysisOutputOptions,
): ValidatedAnalysis {
  const analysis = ModelAnalysisSchema.parse(analysisInput);
  const chunksById = createTrustedChunkMap(sourceChunksInput);
  const issues: string[] = [];

  const resolveEvidence = (
    owner: string,
    references: readonly EvidenceRef[],
  ): SourceChunk[] => {
    const evidenceChunks: SourceChunk[] = [];
    for (const reference of references) {
      const chunk = chunksById.get(reference.chunkId);
      if (chunk === undefined) {
        issues.push(`${owner} references unknown source chunk ${reference.chunkId}.`);
        continue;
      }
      evidenceChunks.push(chunk);
    }
    return evidenceChunks;
  };

  for (const assessment of analysis.assessments) {
    const evidenceChunks = resolveEvidence(
      `Assessment ${assessment.id}`,
      assessment.evidenceRefs,
    );

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

  const assessmentsById = new Map(
    analysis.assessments.map((assessment) => [assessment.id, assessment]),
  );

  for (const section of analysis.enhancedNotes.sections) {
    const owner = `Enhanced-note section ${section.id}`;
    const evidenceChunks = resolveEvidence(owner, section.evidenceRefs);
    const sectionChunkIds = new Set(
      section.evidenceRefs.map((reference) => reference.chunkId),
    );
    const allowedChunkIds = new Set<string>();

    for (const assessmentId of section.assessmentIds) {
      const assessment = assessmentsById.get(assessmentId);
      if (assessment === undefined) continue;
      const assessmentEvidence = assessment.evidenceRefs
        .map((reference) => chunksById.get(reference.chunkId))
        .filter((chunk) => chunk !== undefined);
      const assessmentChunkIds = new Set(
        assessmentEvidence.map((chunk) => chunk.id),
      );
      assessmentChunkIds.forEach((chunkId) => allowedChunkIds.add(chunkId));
      const sharedEvidence = assessmentEvidence.filter((chunk) =>
        sectionChunkIds.has(chunk.id),
      );
      if (!sharedEvidence.some((chunk) => PRIMARY_SOURCE_TYPES.has(chunk.sourceType))) {
        issues.push(
          `${owner} does not share slides or transcript evidence with assessment ${assessmentId}.`,
        );
      }
      if (
        section.changeType !== "new" &&
        !sharedEvidence.some((chunk) => chunk.sourceType === "notes")
      ) {
        issues.push(
          `${owner} does not share notes evidence with assessment ${assessmentId}.`,
        );
      }
    }

    for (const reference of section.evidenceRefs) {
      if (!allowedChunkIds.has(reference.chunkId)) {
        issues.push(
          `${owner} cites evidence outside its linked assessments: ${reference.chunkId}.`,
        );
      }
    }

    const hasPrimaryEvidence = evidenceChunks.some((chunk) =>
      PRIMARY_SOURCE_TYPES.has(chunk.sourceType),
    );
    const hasNotesEvidence = evidenceChunks.some(
      (chunk) => chunk.sourceType === "notes",
    );
    if (!hasPrimaryEvidence) {
      issues.push(`${owner} requires evidence from slides or transcript.`);
    }
    if (section.changeType !== "new" && !hasNotesEvidence) {
      issues.push(`${owner} requires evidence from notes.`);
    }
  }

  for (const card of analysis.ankiCards) {
    const owner = `Anki card ${card.id}`;
    const evidenceChunks = resolveEvidence(owner, card.evidenceRefs);
    const cardChunkIds = new Set(
      card.evidenceRefs.map((reference) => reference.chunkId),
    );
    const allowedChunkIds = new Set<string>();
    for (const assessmentId of card.assessmentIds) {
      const assessment = assessmentsById.get(assessmentId);
      if (assessment === undefined) continue;
      const assessmentEvidence = assessment.evidenceRefs
        .map((reference) => chunksById.get(reference.chunkId))
        .filter((chunk) => chunk !== undefined);
      assessmentEvidence.forEach((chunk) => allowedChunkIds.add(chunk.id));
      if (
        !assessmentEvidence.some(
          (chunk) =>
            cardChunkIds.has(chunk.id) &&
            PRIMARY_SOURCE_TYPES.has(chunk.sourceType),
        )
      ) {
        issues.push(
          `${owner} does not share slides or transcript evidence with assessment ${assessmentId}.`,
        );
      }
    }
    for (const reference of card.evidenceRefs) {
      if (!allowedChunkIds.has(reference.chunkId)) {
        issues.push(
          `${owner} cites evidence outside its linked assessments: ${reference.chunkId}.`,
        );
      }
    }
    if (!evidenceChunks.some((chunk) => PRIMARY_SOURCE_TYPES.has(chunk.sourceType))) {
      issues.push(`${owner} requires evidence from slides or transcript.`);
    }
  }

  if (outputs !== undefined) {
    if (!outputs.ankiCards && analysis.ankiCards.length > 0) {
      issues.push("Anki cards were returned even though they were not requested.");
    }
    if (outputs.ankiCards && analysis.ankiCards.length === 0) {
      issues.push("Anki cards were requested but none were returned.");
    }
    if (outputs.ankiCards) {
      const cardAssessmentIds = new Set(
        analysis.ankiCards.flatMap((card) => card.assessmentIds),
      );
      analysis.assessments
        .filter((assessment) => assessment.importance === "core")
        .forEach((assessment) => {
          if (!cardAssessmentIds.has(assessment.id)) {
            issues.push(
              `Core assessment ${assessment.id} is not represented by an Anki card.`,
            );
          }
        });
    }
  }

  if (issues.length > 0) {
    throw new AnalysisSemanticError(issues);
  }

  return { analysis, chunksById };
}
