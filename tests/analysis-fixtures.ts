import {
  ModelAnalysisSchema,
  type AssessmentStatus,
  type ConceptAssessment,
  type ModelAnalysis,
  type NoteChangeType,
} from "@/domain";
import type { ModelAnalysisWire } from "@/lib/ai/wire";

const CHANGE_TYPE_BY_STATUS: Record<AssessmentStatus, NoteChangeType> = {
  covered: "preserved",
  partial: "expanded",
  missing: "new",
  contradiction: "corrected",
};

export function buildTestAnalysis(
  assessments: readonly ConceptAssessment[],
  options: { summary?: string; includeAnki?: boolean } = {},
): ModelAnalysis {
  const includeAnki = options.includeAnki ?? false;
  return ModelAnalysisSchema.parse({
    summary: options.summary ?? "Synthetic analysis summary.",
    assessments,
    enhancedNotes: {
      title: "Synthetic enhanced notes",
      overview: "A complete, logically ordered guide grounded in the supplied evidence.",
      sections: assessments.map((assessment) => ({
        id: `section-${assessment.id}`,
        heading: assessment.title,
        learningObjective: `Understand ${assessment.title}.`,
        changeType: CHANGE_TYPE_BY_STATUS[assessment.status],
        markdown:
          assessment.suggestedPatch ??
          `The notes preserve the important explanation of ${assessment.title}.`,
        assessmentIds: [assessment.id],
        evidenceRefs: assessment.evidenceRefs,
      })),
    },
    ankiCards: includeAnki
      ? assessments.map((assessment) => {
          const primary = assessment.evidenceRefs.find(
            (reference) =>
              reference.chunkId.startsWith("slides:") ||
              reference.chunkId.startsWith("transcript:"),
          );
          if (primary === undefined) {
            throw new Error(
              `Assessment ${assessment.id} needs primary evidence for an Anki fixture.`,
            );
          }
          return {
            id: `card-${assessment.id}`,
            front: `What should you know about ${assessment.title}?`,
            back: assessment.explanation,
            assessmentIds: [assessment.id],
            evidenceRefs: [primary],
          };
        })
      : [],
  });
}

export function toWireAnalysis(analysis: ModelAnalysis): ModelAnalysisWire {
  return {
    ...analysis,
    assessments: analysis.assessments.map((assessment) => ({
      ...assessment,
      suggestedPatch: assessment.suggestedPatch ?? null,
    })),
  };
}
