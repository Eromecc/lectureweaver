import { describe, expect, it } from "vitest";

import {
  ConceptAssessmentSchema,
  ModelAnalysisSchema,
  SourceChunkSchema,
  type ConceptAssessment,
} from "@/domain";

import { buildTestAnalysis } from "./analysis-fixtures";

function coveredAssessment(
  overrides: Partial<ConceptAssessment> = {},
): ConceptAssessment {
  return {
    id: "concept-spacing",
    title: "Spacing",
    importance: "core",
    status: "covered",
    explanation: "The notes correctly explain spaced study.",
    evidenceRefs: [
      { chunkId: "slides:p0001:c01", relevance: "Defines spacing." },
    ],
    ...overrides,
  };
}

describe("domain schemas", () => {
  it("parses the required domain model and trims textual fields", () => {
    const base = buildTestAnalysis([coveredAssessment()]);
    const parsed = ModelAnalysisSchema.parse({
      ...base,
      summary: "  The notes capture the main idea.  ",
    });

    expect(parsed.summary).toBe("The notes capture the main idea.");
    expect(parsed.assessments[0]?.status).toBe("covered");
  });

  it("rejects unknown fields instead of silently accepting fixture drift", () => {
    const result = SourceChunkSchema.safeParse({
      id: "slides:p0001:c01",
      sourceType: "slides",
      sourceName: "lecture.pdf",
      locator: "Page 1",
      text: "Spacing improves long-term retention.",
      modelLocator: "Untrusted page 99",
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate assessment ids", () => {
    const assessment = coveredAssessment();
    const base = buildTestAnalysis([assessment]);
    const result = ModelAnalysisSchema.safeParse({
      ...base,
      summary: "Summary",
      assessments: [assessment, { ...assessment }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain(
        "Duplicate assessment id",
      );
    }
  });

  it("enforces patch rules for covered and actionable assessments", () => {
    const coveredWithPatch = ConceptAssessmentSchema.safeParse(
      coveredAssessment({ suggestedPatch: "Do not add this." }),
    );
    const missingWithoutPatch = ConceptAssessmentSchema.safeParse(
      coveredAssessment({ status: "missing" }),
    );

    expect(coveredWithPatch.success).toBe(false);
    expect(missingWithoutPatch.success).toBe(false);
  });

  it("rejects duplicate evidence references in one assessment", () => {
    const reference = {
      chunkId: "slides:p0001:c01",
      relevance: "Defines spacing.",
    };
    const result = ConceptAssessmentSchema.safeParse(
      coveredAssessment({ evidenceRefs: [reference, { ...reference }] }),
    );

    expect(result.success).toBe(false);
  });

  it("requires enhanced notes to represent every assessment with the matching change type", () => {
    const base = buildTestAnalysis([coveredAssessment()]);
    const wrongChangeType = ModelAnalysisSchema.safeParse({
      ...base,
      enhancedNotes: {
        ...base.enhancedNotes,
        sections: [
          {
            ...base.enhancedNotes.sections[0],
            changeType: "new",
          },
        ],
      },
    });
    const unknownAssessment = ModelAnalysisSchema.safeParse({
      ...base,
      enhancedNotes: {
        ...base.enhancedNotes,
        sections: [
          {
            ...base.enhancedNotes.sections[0],
            assessmentIds: ["invented-assessment"],
          },
        ],
      },
    });

    expect(wrongChangeType.success).toBe(false);
    expect(unknownAssessment.success).toBe(false);
  });

  it("rejects duplicate Anki ids and normalized fronts", () => {
    const base = buildTestAnalysis([coveredAssessment()], {
      includeAnki: true,
    });
    const card = base.ankiCards[0];
    if (card === undefined) throw new Error("Expected an Anki fixture card.");

    const duplicateId = ModelAnalysisSchema.safeParse({
      ...base,
      ankiCards: [card, { ...card, front: "A different question" }],
    });
    const duplicateFront = ModelAnalysisSchema.safeParse({
      ...base,
      ankiCards: [
        card,
        { ...card, id: "another-card", front: `  ${card.front.toUpperCase()}  ` },
      ],
    });
    const unicodeEquivalentFront = ModelAnalysisSchema.safeParse({
      ...base,
      ankiCards: [
        { ...card, front: "What is café recall?" },
        {
          ...card,
          id: "unicode-equivalent-card",
          front: "What is cafe\u0301 recall?",
        },
      ],
    });

    expect(duplicateId.success).toBe(false);
    expect(duplicateFront.success).toBe(false);
    expect(unicodeEquivalentFront.success).toBe(false);
  });

  it("applies generated-Markdown safety rules to enhanced note sections", () => {
    const base = buildTestAnalysis([coveredAssessment()]);
    const result = ModelAnalysisSchema.safeParse({
      ...base,
      enhancedNotes: {
        ...base.enhancedNotes,
        sections: [
          {
            ...base.enhancedNotes.sections[0],
            markdown: "Read the hidden tracker at https://example.test/pixel.",
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });

  it("keeps model prose below the application-owned note hierarchy", () => {
    const base = buildTestAnalysis([coveredAssessment()]);
    const result = ModelAnalysisSchema.safeParse({
      ...base,
      enhancedNotes: {
        ...base.enhancedNotes,
        sections: [
          {
            ...base.enhancedNotes.sections[0],
            markdown: "# A second document title\n\nThis would break the contents hierarchy.",
          },
        ],
      },
    });

    expect(result.success).toBe(false);
  });
});
