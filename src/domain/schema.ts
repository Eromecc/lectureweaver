import { z } from "zod";

import {
  MAX_ANKI_BACK_CHARACTERS,
  MAX_ANKI_CARDS,
  MAX_ANKI_FRONT_CHARACTERS,
  MAX_ENHANCED_NOTES_CHARACTERS,
  MAX_ENHANCED_NOTE_SECTIONS,
  MAX_ENHANCED_NOTE_SECTION_CHARACTERS,
} from "./limits";

const nonEmptyText = z.string().trim().min(1);
const safeGeneratedMarkdown = (maxCharacters: number) =>
  nonEmptyText.max(maxCharacters).superRefine((value, context) => {
    if (/<\/?[A-Za-z][^>]*>|<!--/i.test(value)) {
      context.addIssue({
        code: "custom",
        message: "Generated Markdown cannot contain raw HTML or autolinks.",
      });
    }
    if (/!\s*\[/.test(value)) {
      context.addIssue({
        code: "custom",
        message: "Generated Markdown cannot contain images.",
      });
    }
    if (/\[[^\]\n]+\]\s*(?:\(|\[)/.test(value)) {
      context.addIssue({
        code: "custom",
        message: "Generated Markdown cannot contain links.",
      });
    }
    if (/^\s{0,3}\[[^\]\n]+\]:/m.test(value)) {
      context.addIssue({
        code: "custom",
        message: "Generated Markdown cannot contain link reference definitions.",
      });
    }
    if (/(?:https?|ftp):\/\/|\bmailto:|(?:^|\s)www\./i.test(value)) {
      context.addIssue({
        code: "custom",
        message: "Generated Markdown cannot contain bare external URLs.",
      });
    }
    if (
      /^\s{0,3}#{1,2}(?:\s|$)/m.test(value) ||
      /^\S.*\n\s{0,3}(?:=+|-+)\s*$/m.test(value)
    ) {
      context.addIssue({
        code: "custom",
        message: "Generated Markdown cannot redefine top-level note headings.",
      });
    }
  });

const uniqueTextList = (maximum: number) =>
  z.array(nonEmptyText.max(160)).min(1).max(maximum).superRefine((values, context) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate reference id: ${value}.`,
          path: [index],
        });
      }
      seen.add(value);
    });
  });

export const SourceTypeSchema = z.enum(["slides", "transcript", "notes"]);

export const AssessmentStatusSchema = z.enum([
  "covered",
  "partial",
  "missing",
  "contradiction",
]);

export const ImportanceSchema = z.enum(["core", "supporting"]);

export const NoteChangeTypeSchema = z.enum([
  "preserved",
  "expanded",
  "corrected",
  "new",
]);

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

const EvidenceRefListSchema = z
  .array(EvidenceRefSchema)
  .min(1)
  .max(12)
  .superRefine((references, context) => {
    const seen = new Set<string>();
    references.forEach((reference, index) => {
      if (seen.has(reference.chunkId)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate evidence reference: ${reference.chunkId}.`,
          path: [index, "chunkId"],
        });
      }
      seen.add(reference.chunkId);
    });
  });

export const ConceptAssessmentSchema = z
  .object({
    id: nonEmptyText,
    title: nonEmptyText,
    importance: ImportanceSchema,
    status: AssessmentStatusSchema,
    explanation: nonEmptyText,
    evidenceRefs: EvidenceRefListSchema,
    suggestedPatch: safeGeneratedMarkdown(4_000).optional(),
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

  });

export const EnhancedNoteSectionSchema = z
  .object({
    id: nonEmptyText.max(160),
    heading: nonEmptyText.max(240),
    learningObjective: nonEmptyText.max(500),
    changeType: NoteChangeTypeSchema,
    markdown: safeGeneratedMarkdown(MAX_ENHANCED_NOTE_SECTION_CHARACTERS),
    assessmentIds: uniqueTextList(12),
    evidenceRefs: EvidenceRefListSchema,
  })
  .strict();

export const EnhancedNotesSchema = z
  .object({
    title: nonEmptyText.max(240),
    overview: safeGeneratedMarkdown(2_400),
    sections: z
      .array(EnhancedNoteSectionSchema)
      .min(1)
      .max(MAX_ENHANCED_NOTE_SECTIONS),
  })
  .strict()
  .superRefine((notes, context) => {
    const sectionIds = new Set<string>();
    let totalCharacters = notes.overview.length;

    notes.sections.forEach((section, index) => {
      if (sectionIds.has(section.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate enhanced-note section id: ${section.id}.`,
          path: ["sections", index, "id"],
        });
      }
      sectionIds.add(section.id);
      totalCharacters += section.markdown.length;
    });

    if (totalCharacters > MAX_ENHANCED_NOTES_CHARACTERS) {
      context.addIssue({
        code: "custom",
        message: `Enhanced notes cannot exceed ${MAX_ENHANCED_NOTES_CHARACTERS} characters.`,
        path: ["sections"],
      });
    }
  });

export const AnkiCardSchema = z
  .object({
    id: nonEmptyText.max(160),
    front: nonEmptyText.max(MAX_ANKI_FRONT_CHARACTERS),
    back: nonEmptyText.max(MAX_ANKI_BACK_CHARACTERS),
    assessmentIds: uniqueTextList(8),
    evidenceRefs: EvidenceRefListSchema,
  })
  .strict();

export const ModelAnalysisSchema = z
  .object({
    summary: nonEmptyText,
    assessments: z.array(ConceptAssessmentSchema).min(1),
    enhancedNotes: EnhancedNotesSchema,
    ankiCards: z.array(AnkiCardSchema).max(MAX_ANKI_CARDS),
  })
  .strict()
  .superRefine((analysis, context) => {
    const assessmentIds = new Set<string>();
    const assessmentStatusById = new Map<string, z.infer<typeof AssessmentStatusSchema>>();

    analysis.assessments.forEach((assessment, index) => {
      if (assessmentIds.has(assessment.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate assessment id: ${assessment.id}.`,
          path: ["assessments", index, "id"],
        });
      }
      assessmentIds.add(assessment.id);
      assessmentStatusById.set(assessment.id, assessment.status);
    });

    const representedAssessmentIds = new Set<string>();
    const expectedStatusByChangeType: Record<
      z.infer<typeof NoteChangeTypeSchema>,
      z.infer<typeof AssessmentStatusSchema>
    > = {
      preserved: "covered",
      expanded: "partial",
      corrected: "contradiction",
      new: "missing",
    };

    analysis.enhancedNotes.sections.forEach((section, sectionIndex) => {
      section.assessmentIds.forEach((assessmentId, assessmentIndex) => {
        const status = assessmentStatusById.get(assessmentId);
        if (status === undefined) {
          context.addIssue({
            code: "custom",
            message: `Enhanced-note section references unknown assessment: ${assessmentId}.`,
            path: ["enhancedNotes", "sections", sectionIndex, "assessmentIds", assessmentIndex],
          });
          return;
        }
        representedAssessmentIds.add(assessmentId);
        if (status !== expectedStatusByChangeType[section.changeType]) {
          context.addIssue({
            code: "custom",
            message: `${section.changeType} sections can only reference ${expectedStatusByChangeType[section.changeType]} assessments.`,
            path: ["enhancedNotes", "sections", sectionIndex, "assessmentIds", assessmentIndex],
          });
        }
      });
    });

    analysis.assessments.forEach((assessment, assessmentIndex) => {
      if (!representedAssessmentIds.has(assessment.id)) {
        context.addIssue({
          code: "custom",
          message: `Assessment ${assessment.id} is not represented in the enhanced notes.`,
          path: ["assessments", assessmentIndex, "id"],
        });
      }
    });

    const cardIds = new Set<string>();
    const normalizedFronts = new Set<string>();
    analysis.ankiCards.forEach((card, cardIndex) => {
      if (cardIds.has(card.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate Anki card id: ${card.id}.`,
          path: ["ankiCards", cardIndex, "id"],
        });
      }
      cardIds.add(card.id);

      const normalizedFront = card.front
        .normalize("NFC")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      if (normalizedFronts.has(normalizedFront)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate Anki card front: ${card.front}.`,
          path: ["ankiCards", cardIndex, "front"],
        });
      }
      normalizedFronts.add(normalizedFront);

      card.assessmentIds.forEach((assessmentId, assessmentIndex) => {
        if (!assessmentIds.has(assessmentId)) {
          context.addIssue({
            code: "custom",
            message: `Anki card references unknown assessment: ${assessmentId}.`,
            path: ["ankiCards", cardIndex, "assessmentIds", assessmentIndex],
          });
        }
      });
    });
  });

export const SourceChunkListSchema = z.array(SourceChunkSchema);

export type SourceType = z.infer<typeof SourceTypeSchema>;
export type AssessmentStatus = z.infer<typeof AssessmentStatusSchema>;
export type Importance = z.infer<typeof ImportanceSchema>;
export type NoteChangeType = z.infer<typeof NoteChangeTypeSchema>;
export type SourceChunk = z.infer<typeof SourceChunkSchema>;
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type ConceptAssessment = z.infer<typeof ConceptAssessmentSchema>;
export type EnhancedNoteSection = z.infer<typeof EnhancedNoteSectionSchema>;
export type EnhancedNotes = z.infer<typeof EnhancedNotesSchema>;
export type AnkiCard = z.infer<typeof AnkiCardSchema>;
export type ModelAnalysis = z.infer<typeof ModelAnalysisSchema>;
