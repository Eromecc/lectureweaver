import type { AssessmentStatus, Importance } from "@/domain";

import type {
  HydratedAnalysis,
  HydratedConceptAssessment,
  HydratedEvidence,
} from "./hydration";

const STATUS_ORDER = ["missing", "partial", "contradiction"] as const;

const STATUS_HEADINGS: Record<(typeof STATUS_ORDER)[number], string> = {
  missing: "Missing concepts",
  partial: "Partially covered concepts",
  contradiction: "Possible contradictions",
};

const STATUS_RANK: Readonly<Record<AssessmentStatus, number>> = {
  missing: 0,
  partial: 1,
  contradiction: 2,
  covered: 3,
};

const IMPORTANCE_RANK: Readonly<Record<Importance, number>> = {
  core: 0,
  supporting: 1,
};

function escapeInlineMarkdown(value: string): string {
  return value.replace(/([\\`*_[\]<>])/g, "\\$1").replace(/\s+/g, " ").trim();
}

function formatEvidence(evidence: readonly HydratedEvidence[]): string {
  const seenChunkIds = new Set<string>();
  const locators: string[] = [];

  for (const item of evidence) {
    if (seenChunkIds.has(item.chunkId)) {
      continue;
    }
    seenChunkIds.add(item.chunkId);

    const heading = item.chunk.headingPath?.length
      ? ` — ${item.chunk.headingPath.map(escapeInlineMarkdown).join(" › ")}`
      : "";
    locators.push(
      `${escapeInlineMarkdown(item.chunk.sourceName)} · ${escapeInlineMarkdown(item.chunk.locator)}${heading}`,
    );
  }

  return locators.join("; ");
}

function sortedActionableAssessments(
  assessments: readonly HydratedConceptAssessment[],
): HydratedConceptAssessment[] {
  return assessments
    .map((assessment, originalIndex) => ({ assessment, originalIndex }))
    .filter(({ assessment }) => assessment.status !== "covered")
    .sort((left, right) => {
      const statusDifference =
        STATUS_RANK[left.assessment.status] - STATUS_RANK[right.assessment.status];
      if (statusDifference !== 0) {
        return statusDifference;
      }

      const importanceDifference =
        IMPORTANCE_RANK[left.assessment.importance] -
        IMPORTANCE_RANK[right.assessment.importance];
      return importanceDifference || left.originalIndex - right.originalIndex;
    })
    .map(({ assessment }) => assessment);
}

export function generateMarkdownPatch(analysis: HydratedAnalysis): string {
  const assessments = sortedActionableAssessments(analysis.assessments);
  if (assessments.length === 0) {
    return "";
  }

  const output: string[] = ["# Suggested note additions"];

  for (const status of STATUS_ORDER) {
    const matchingAssessments = assessments.filter(
      (assessment) => assessment.status === status,
    );
    if (matchingAssessments.length === 0) {
      continue;
    }

    output.push("", `## ${STATUS_HEADINGS[status]}`);
    for (const assessment of matchingAssessments) {
      output.push(
        "",
        `### ${escapeInlineMarkdown(assessment.title)}`,
        "",
        assessment.suggestedPatch ?? "",
        "",
        `> Evidence: ${formatEvidence(assessment.evidence)}`,
      );
    }
  }

  return `${output.join("\n").trim()}\n`;
}
