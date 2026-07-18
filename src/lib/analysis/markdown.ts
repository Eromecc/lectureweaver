import type { AssessmentStatus, Importance, OutputLanguage } from "@/domain";

import type {
  HydratedAnalysis,
  HydratedConceptAssessment,
  HydratedEvidence,
} from "./hydration";

const STATUS_ORDER = ["missing", "partial", "contradiction"] as const;

type MarkdownLabels = {
  suggestedAdditions: string;
  contents: string;
  learningObjective: string;
  evidence: string;
  statusHeadings: Record<(typeof STATUS_ORDER)[number], string>;
};

const MARKDOWN_LABELS: Readonly<Record<OutputLanguage, MarkdownLabels>> = {
  en: {
    suggestedAdditions: "Suggested note additions",
    contents: "Contents",
    learningObjective: "Learning objective",
    evidence: "Evidence",
    statusHeadings: {
      missing: "Missing concepts",
      partial: "Partially covered concepts",
      contradiction: "Possible contradictions",
    },
  },
  "zh-CN": {
    suggestedAdditions: "建议补充的笔记",
    contents: "目录",
    learningObjective: "学习目标",
    evidence: "证据",
    statusHeadings: {
      missing: "缺失概念",
      partial: "覆盖不完整的概念",
      contradiction: "可能的矛盾",
    },
  },
  ja: {
    suggestedAdditions: "推奨ノート追記",
    contents: "目次",
    learningObjective: "学習目標",
    evidence: "根拠",
    statusHeadings: {
      missing: "不足している概念",
      partial: "一部のみ扱われた概念",
      contradiction: "考えられる矛盾",
    },
  },
  ko: {
    suggestedAdditions: "권장 노트 추가 사항",
    contents: "목차",
    learningObjective: "학습 목표",
    evidence: "근거",
    statusHeadings: {
      missing: "누락된 개념",
      partial: "일부만 다룬 개념",
      contradiction: "가능한 모순",
    },
  },
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

function formatTrustedEvidenceItem(item: HydratedEvidence): string {
  const heading = item.chunk.headingPath?.length
    ? ` — ${item.chunk.headingPath.join(" › ")}`
    : "";
  return `${item.chunk.sourceName} · ${item.chunk.locator}${heading}`;
}

export function formatTrustedEvidence(
  evidence: readonly HydratedEvidence[],
): string {
  const seenChunkIds = new Set<string>();
  const locators: string[] = [];

  for (const item of evidence) {
    if (seenChunkIds.has(item.chunkId)) {
      continue;
    }
    seenChunkIds.add(item.chunkId);

    locators.push(formatTrustedEvidenceItem(item));
  }

  return locators.join("; ");
}

function formatMarkdownEvidence(evidence: readonly HydratedEvidence[]): string {
  const seenChunkIds = new Set<string>();
  return evidence
    .filter((item) => {
      if (seenChunkIds.has(item.chunkId)) return false;
      seenChunkIds.add(item.chunkId);
      return true;
    })
    .map((item) => escapeInlineMarkdown(formatTrustedEvidenceItem(item)))
    .join("; ");
}

function markdownHeadingSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/[\s-]+/g, "-");
  return slug || "section";
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

export function generateMarkdownPatch(
  analysis: HydratedAnalysis,
  outputLanguage: OutputLanguage = "en",
): string {
  const assessments = sortedActionableAssessments(analysis.assessments);
  if (assessments.length === 0) {
    return "";
  }

  const labels = MARKDOWN_LABELS[outputLanguage];
  const output: string[] = [`# ${labels.suggestedAdditions}`];

  for (const status of STATUS_ORDER) {
    const matchingAssessments = assessments.filter(
      (assessment) => assessment.status === status,
    );
    if (matchingAssessments.length === 0) {
      continue;
    }

    output.push("", `## ${labels.statusHeadings[status]}`);
    for (const assessment of matchingAssessments) {
      output.push(
        "",
        `### ${escapeInlineMarkdown(assessment.title)}`,
        "",
        assessment.suggestedPatch ?? "",
        "",
        `> ${labels.evidence}: ${formatMarkdownEvidence(assessment.evidence)}`,
      );
    }
  }

  return `${output.join("\n").trim()}\n`;
}

export function generateEnhancedNotesMarkdown(
  analysis: HydratedAnalysis,
  outputLanguage: OutputLanguage = "en",
): string {
  const labels = MARKDOWN_LABELS[outputLanguage];
  const sectionHeadings = analysis.enhancedNotes.sections.map(
    (section, index) => `${index + 1}. ${section.heading}`,
  );
  const output = [
    `# ${escapeInlineMarkdown(analysis.enhancedNotes.title)}`,
    "",
    analysis.enhancedNotes.overview,
    "",
    `## ${labels.contents}`,
  ];

  sectionHeadings.forEach((heading) => {
    output.push(
      `- [${escapeInlineMarkdown(heading)}](#${markdownHeadingSlug(heading)})`,
    );
  });

  analysis.enhancedNotes.sections.forEach((section, index) => {
    output.push(
      "",
      `## ${escapeInlineMarkdown(sectionHeadings[index] ?? section.heading)}`,
      "",
      `**${labels.learningObjective}:** ${escapeInlineMarkdown(section.learningObjective)}`,
      "",
      section.markdown,
      "",
      `> ${labels.evidence}: ${formatMarkdownEvidence(section.evidence)}`,
    );
  });

  return `${output.join("\n").trim()}\n`;
}
