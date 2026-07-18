import { z } from "zod";

import {
  AssessmentStatusSchema,
  ImportanceSchema,
  MAX_ANKI_BACK_CHARACTERS,
  MAX_ANKI_CARDS,
  MAX_ANKI_FRONT_CHARACTERS,
  MAX_ENHANCED_NOTE_SECTIONS,
  MAX_ENHANCED_NOTE_SECTION_CHARACTERS,
  ModelAnalysisSchema,
  NoteChangeTypeSchema,
  type ModelAnalysis,
} from "@/domain";

const wireText = z.string().trim().min(1);

export const ModelEvidenceRefWireSchema = z
  .object({
    chunkId: wireText.max(160),
    relevance: wireText.max(1_200),
  })
  .strict();

export const ModelConceptAssessmentWireSchema = z
  .object({
    id: wireText.max(160),
    title: wireText.max(240),
    importance: ImportanceSchema,
    status: AssessmentStatusSchema,
    explanation: wireText.max(2_400),
    evidenceRefs: z.array(ModelEvidenceRefWireSchema).min(1).max(8),
    suggestedPatch: wireText.max(4_000).nullable(),
  })
  .strict();

export const ModelEnhancedNoteSectionWireSchema = z
  .object({
    id: wireText.max(160),
    heading: wireText.max(240),
    learningObjective: wireText.max(500),
    changeType: NoteChangeTypeSchema,
    markdown: wireText.max(MAX_ENHANCED_NOTE_SECTION_CHARACTERS),
    assessmentIds: z.array(wireText.max(160)).min(1).max(12),
    evidenceRefs: z.array(ModelEvidenceRefWireSchema).min(1).max(12),
  })
  .strict();

export const ModelEnhancedNotesWireSchema = z
  .object({
    title: wireText.max(240),
    overview: wireText.max(2_400),
    sections: z
      .array(ModelEnhancedNoteSectionWireSchema)
      .min(1)
      .max(MAX_ENHANCED_NOTE_SECTIONS),
  })
  .strict();

export const ModelAnkiCardWireSchema = z
  .object({
    id: wireText.max(160),
    front: wireText.max(MAX_ANKI_FRONT_CHARACTERS),
    back: wireText.max(MAX_ANKI_BACK_CHARACTERS),
    assessmentIds: z.array(wireText.max(160)).min(1).max(8),
    evidenceRefs: z.array(ModelEvidenceRefWireSchema).min(1).max(12),
  })
  .strict();

export const ModelAnalysisWireSchema = z
  .object({
    summary: wireText.max(2_400),
    assessments: z.array(ModelConceptAssessmentWireSchema).min(1).max(30),
    enhancedNotes: ModelEnhancedNotesWireSchema,
    ankiCards: z.array(ModelAnkiCardWireSchema).max(MAX_ANKI_CARDS),
  })
  .strict();

export const MODEL_ANALYSIS_JSON_SCHEMA = z.toJSONSchema(
  ModelAnalysisWireSchema,
  { target: "draft-7" },
);

export function parseModelAnalysisWire(input: unknown): ModelAnalysis {
  const wire = ModelAnalysisWireSchema.parse(input);
  return ModelAnalysisSchema.parse({
    summary: wire.summary,
    assessments: wire.assessments.map((assessment) => {
      const { suggestedPatch, ...required } = assessment;
      return suggestedPatch === null
        ? required
        : { ...required, suggestedPatch };
    }),
    enhancedNotes: wire.enhancedNotes,
    ankiCards: wire.ankiCards,
  });
}

export function parseModelAnalysisText(text: string): ModelAnalysis {
  const normalized = text.trim();
  if (normalized.length === 0) {
    throw new SyntaxError("The model returned an empty response.");
  }
  return parseModelAnalysisWire(JSON.parse(normalized) as unknown);
}

export type ModelAnalysisWire = z.infer<typeof ModelAnalysisWireSchema>;
