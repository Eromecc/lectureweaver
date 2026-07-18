import type {
  ConceptAssessment,
  AnkiCard,
  AnalysisOutputOptions,
  EnhancedNoteSection,
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

export type HydratedEnhancedNoteSection = Omit<
  EnhancedNoteSection,
  "evidenceRefs"
> & {
  evidence: HydratedEvidence[];
};

export type HydratedAnkiCard = Omit<AnkiCard, "evidenceRefs"> & {
  evidence: HydratedEvidence[];
};

export type HydratedAnalysis = Omit<
  ModelAnalysis,
  "assessments" | "enhancedNotes" | "ankiCards"
> & {
  assessments: HydratedConceptAssessment[];
  enhancedNotes: Omit<ModelAnalysis["enhancedNotes"], "sections"> & {
    sections: HydratedEnhancedNoteSection[];
  };
  ankiCards: HydratedAnkiCard[];
};

export function hydrateAnalysis(
  analysisInput: unknown,
  sourceChunksInput: unknown,
  outputs?: AnalysisOutputOptions,
): HydratedAnalysis {
  const { analysis, chunksById } = validateModelAnalysisAgainstChunks(
    analysisInput,
    sourceChunksInput,
    outputs,
  );

  const hydrateEvidence = (references: readonly EvidenceRef[]) =>
    references.map((reference) => {
      const chunk = chunksById.get(reference.chunkId);

      if (chunk === undefined) {
        throw new Error(
          `Evidence hydration invariant failed for chunk ${reference.chunkId}.`,
        );
      }

      return { ...reference, chunk };
    });

  return {
    summary: analysis.summary,
    assessments: analysis.assessments.map((assessment) => {
      const { evidenceRefs, ...assessmentFields } = assessment;
      return { ...assessmentFields, evidence: hydrateEvidence(evidenceRefs) };
    }),
    enhancedNotes: {
      title: analysis.enhancedNotes.title,
      overview: analysis.enhancedNotes.overview,
      sections: analysis.enhancedNotes.sections.map((section) => {
        const { evidenceRefs, ...sectionFields } = section;
        return { ...sectionFields, evidence: hydrateEvidence(evidenceRefs) };
      }),
    },
    ankiCards: analysis.ankiCards.map((card) => {
      const { evidenceRefs, ...cardFields } = card;
      return { ...cardFields, evidence: hydrateEvidence(evidenceRefs) };
    }),
  };
}
