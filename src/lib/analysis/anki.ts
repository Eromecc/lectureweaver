import type { OutputLanguage } from "@/domain";

import type {
  HydratedAnalysis,
  HydratedAnkiCard,
} from "./hydration";
import { formatTrustedEvidence } from "./markdown";

const SOURCE_LABELS: Readonly<Record<OutputLanguage, string>> = {
  en: "Source",
  "zh-CN": "来源",
  ja: "出典",
  ko: "출처",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textToAnkiHtml(value: string): string {
  return escapeHtml(value.replace(/\r\n?/g, "\n")).replace(/\n/g, "<br>");
}

function quoteTsvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function tagsForCard(
  card: HydratedAnkiCard,
  analysis: HydratedAnalysis,
): string[] {
  const assessments = card.assessmentIds
    .map((assessmentId) =>
      analysis.assessments.find((assessment) => assessment.id === assessmentId),
    )
    .filter((assessment) => assessment !== undefined);
  const importance = assessments.some(
    (assessment) => assessment.importance === "core",
  )
    ? "core"
    : "supporting";
  const statusTags = new Set(
    assessments.map(
      (assessment) => `lectureweaver::status::${assessment.status}`,
    ),
  );

  return [
    "lectureweaver",
    `lectureweaver::importance::${importance}`,
    ...statusTags,
  ].sort();
}

export function generateAnkiImportText(
  analysis: HydratedAnalysis,
  outputLanguage: OutputLanguage = "en",
): string {
  const output = [
    "#separator:tab",
    "#html:true",
    "#columns:Front\tBack\tTags",
    "#tags column:3",
  ];

  for (const card of analysis.ankiCards) {
    const source = formatTrustedEvidence(card.evidence);
    const back = `${textToAnkiHtml(card.back)}<br><br>${SOURCE_LABELS[outputLanguage]}: ${textToAnkiHtml(source)}`;
    output.push(
      [
        quoteTsvField(textToAnkiHtml(card.front)),
        quoteTsvField(back),
        quoteTsvField(tagsForCard(card, analysis).join(" ")),
      ].join("\t"),
    );
  }

  return `${output.join("\n")}\n`;
}
