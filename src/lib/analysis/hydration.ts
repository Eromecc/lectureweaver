import type {
  ConceptAssessment,
  EvidenceRef,
  ModelAnalysis,
  SourceChunk,
} from "@/domain";

import { validateModelAnalysisAgainstChunks } from "./validate";

export type HydratedEvidence = EvidenceRef & {
  chunk: SourceChunk;
};

export type HydratedConceptAssessment = Omit<
  ConceptAssessment,
  "evidenceRefs"
> & {
  evidence: HydratedEvidence[];
};

export type HydratedAnalysis = Omit<ModelAnalysis, "assessments"> & {
  assessments: HydratedConceptAssessment[];
};

export function hydrateAnalysis(
  analysisInput: unknown,
  sourceChunksInput: unknown,
): HydratedAnalysis {
  const { analysis, chunksById } = validateModelAnalysisAgainstChunks(
    analysisInput,
    sourceChunksInput,
  );

  return {
    summary: analysis.summary,
    assessments: analysis.assessments.map((assessment) => {
      const { evidenceRefs, ...assessmentFields } = assessment;
      const evidence = evidenceRefs.map((reference) => {
        const chunk = chunksById.get(reference.chunkId);

        if (chunk === undefined) {
          throw new Error(
            `Evidence hydration invariant failed for chunk ${reference.chunkId}.`,
          );
        }

        return { ...reference, chunk };
      });

      return { ...assessmentFields, evidence };
    }),
  };
}
