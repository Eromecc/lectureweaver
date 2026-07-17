import { z } from "zod";

const nonEmptyText = z.string().trim().min(1);
const safeMarkdownPatch = nonEmptyText.superRefine((value, context) => {
  if (/<\/?[A-Za-z][^>]*>|<!--/i.test(value)) {
    context.addIssue({
      code: "custom",
      message: "Suggested patches cannot contain raw HTML or autolinks.",
    });
  }
  if (/!\s*\[/.test(value)) {
    context.addIssue({
      code: "custom",
      message: "Suggested patches cannot contain Markdown images.",
    });
  }
  if (/\[[^\]\n]+\]\s*(?:\(|\[)/.test(value)) {
    context.addIssue({
      code: "custom",
      message: "Suggested patches cannot contain Markdown links.",
    });
  }
  if (/^\s{0,3}\[[^\]\n]+\]:/m.test(value)) {
    context.addIssue({
      code: "custom",
      message: "Suggested patches cannot contain link reference definitions.",
    });
  }
  if (/(?:https?|ftp):\/\/|\bmailto:|(?:^|\s)www\./i.test(value)) {
    context.addIssue({
      code: "custom",
      message: "Suggested patches cannot contain bare external URLs.",
    });
  }
});

export const SourceTypeSchema = z.enum(["slides", "transcript", "notes"]);

export const AssessmentStatusSchema = z.enum([
  "covered",
  "partial",
  "missing",
  "contradiction",
]);

export const ImportanceSchema = z.enum(["core", "supporting"]);

export const SourceChunkSchema = z
  .object({
    id: nonEmptyText,
    sourceType: SourceTypeSchema,
    sourceName: nonEmptyText,
    locator: nonEmptyText,
    headingPath: z.array(nonEmptyText).optional(),
    text: nonEmptyText,
  })
  .strict();

export const EvidenceRefSchema = z
  .object({
    chunkId: nonEmptyText,
    relevance: nonEmptyText,
  })
  .strict();

export const ConceptAssessmentSchema = z
  .object({
    id: nonEmptyText,
    title: nonEmptyText,
    importance: ImportanceSchema,
    status: AssessmentStatusSchema,
    explanation: nonEmptyText,
    evidenceRefs: z.array(EvidenceRefSchema).min(1),
    suggestedPatch: safeMarkdownPatch.optional(),
  })
  .strict()
  .superRefine((assessment, context) => {
    if (assessment.status === "covered" && assessment.suggestedPatch !== undefined) {
      context.addIssue({
        code: "custom",
        message: "Covered assessments cannot include a suggested patch.",
        path: ["suggestedPatch"],
      });
    }

    if (assessment.status !== "covered" && assessment.suggestedPatch === undefined) {
      context.addIssue({
        code: "custom",
        message: `${assessment.status} assessments require a suggested patch.`,
        path: ["suggestedPatch"],
      });
    }

    const referencedChunkIds = new Set<string>();
    assessment.evidenceRefs.forEach((reference, index) => {
      if (referencedChunkIds.has(reference.chunkId)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate evidence reference: ${reference.chunkId}.`,
          path: ["evidenceRefs", index, "chunkId"],
        });
      }
      referencedChunkIds.add(reference.chunkId);
    });
  });

export const ModelAnalysisSchema = z
  .object({
    summary: nonEmptyText,
    assessments: z.array(ConceptAssessmentSchema).min(1),
  })
  .strict()
  .superRefine((analysis, context) => {
    const assessmentIds = new Set<string>();

    analysis.assessments.forEach((assessment, index) => {
      if (assessmentIds.has(assessment.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate assessment id: ${assessment.id}.`,
          path: ["assessments", index, "id"],
        });
      }
      assessmentIds.add(assessment.id);
    });
  });

export const SourceChunkListSchema = z.array(SourceChunkSchema);

export type SourceType = z.infer<typeof SourceTypeSchema>;
export type AssessmentStatus = z.infer<typeof AssessmentStatusSchema>;
export type Importance = z.infer<typeof ImportanceSchema>;
export type SourceChunk = z.infer<typeof SourceChunkSchema>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type ConceptAssessment = z.infer<typeof ConceptAssessmentSchema>;
export type ModelAnalysis = z.infer<typeof ModelAnalysisSchema>;
