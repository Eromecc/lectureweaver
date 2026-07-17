import { z } from "zod";

import {
  AssessmentStatusSchema,
  ImportanceSchema,
  ModelAnalysisSchema,
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

export const ModelAnalysisWireSchema = z
  .object({
    summary: wireText.max(2_400),
    assessments: z.array(ModelConceptAssessmentWireSchema).min(1).max(30),
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
