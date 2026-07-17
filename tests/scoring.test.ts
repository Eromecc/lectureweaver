import { describe, expect, it } from "vitest";

import type {
  AssessmentStatus,
  ConceptAssessment,
  Importance,
} from "@/domain";
import {
  calculateCoverageMetrics,
  calculateCoverageScore,
} from "@/lib/analysis";

function assessment(
  status: AssessmentStatus,
  importance: Importance = "core",
): ConceptAssessment {
  return {
    id: `${status}-${importance}`,
    title: status,
    importance,
    status,
    explanation: `${status} explanation`,
    evidenceRefs: [{ chunkId: "slides:p0001:c01", relevance: "Relevant" }],
    ...(status === "covered" ? {} : { suggestedPatch: `${status} patch` }),
  };
}

describe("deterministic coverage scoring", () => {
  it.each([
    ["covered", 100],
    ["partial", 50],
    ["missing", 0],
    ["contradiction", 0],
  ] as const)("scores one %s assessment as %i", (status, expected) => {
    expect(calculateCoverageScore([assessment(status)])).toBe(expected);
  });

  it("rounds a mixed result with missing and contradiction contributing zero", () => {
    const metrics = calculateCoverageMetrics([
      assessment("covered"),
      assessment("partial"),
      assessment("missing"),
      assessment("contradiction"),
    ]);

    expect(metrics).toEqual({
      score: 38,
      total: 4,
      counts: {
        covered: 1,
        partial: 1,
        missing: 1,
        contradiction: 1,
      },
    });
  });

  it("does not weight core concepts differently from supporting concepts", () => {
    const coreScore = calculateCoverageScore([
      assessment("covered", "core"),
      assessment("missing", "core"),
    ]);
    const supportingScore = calculateCoverageScore([
      assessment("covered", "supporting"),
      assessment("missing", "supporting"),
    ]);

    expect(coreScore).toBe(50);
    expect(supportingScore).toBe(coreScore);
  });

  it("rejects an empty assessment set", () => {
    expect(() => calculateCoverageScore([])).toThrow(
      "Cannot calculate coverage without assessments",
    );
  });
});
