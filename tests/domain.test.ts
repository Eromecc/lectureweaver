import { describe, expect, it } from "vitest";

import {
  ConceptAssessmentSchema,
  ModelAnalysisSchema,
  SourceChunkSchema,
  type ConceptAssessment,
} from "@/domain";

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
    const parsed = ModelAnalysisSchema.parse({
      summary: "  The notes capture the main idea.  ",
      assessments: [coveredAssessment()],
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
    const result = ModelAnalysisSchema.safeParse({
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
});
