import type { AssessmentStatus, ConceptAssessment } from "@/domain";

export type CoverageCounts = Record<AssessmentStatus, number>;

export type CoverageMetrics = {
  score: number;
  total: number;
  counts: CoverageCounts;
};

function emptyCounts(): CoverageCounts {
  return {
    covered: 0,
    partial: 0,
    missing: 0,
    contradiction: 0,
  };
}

export function calculateCoverageMetrics(
  assessments: readonly Pick<ConceptAssessment, "status">[],
): CoverageMetrics {
  if (assessments.length === 0) {
    throw new RangeError("Cannot calculate coverage without assessments.");
  }

  const counts = emptyCounts();
  for (const assessment of assessments) {
    counts[assessment.status] += 1;
  }

  const score = Math.round(
    (100 * (counts.covered + 0.5 * counts.partial)) / assessments.length,
  );

  return { score, total: assessments.length, counts };
}

export function calculateCoverageScore(
  assessments: readonly Pick<ConceptAssessment, "status">[],
): number {
  return calculateCoverageMetrics(assessments).score;
}
