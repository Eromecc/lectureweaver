import type { OutputLanguage } from "@/domain";

import type { HydratedAnalysis } from "./hydration";

const NARRATION_LABELS: Readonly<
  Record<
    OutputLanguage,
    {
      fullGuide: string;
      studyGuide: string;
      section: string;
      learningObjective: string;
    }
  >
> = {
  en: {
    fullGuide: "Full study guide",
    studyGuide: "Study guide",
    section: "Section",
    learningObjective: "Learning objective",
  },
  "zh-CN": {
    fullGuide: "完整学习指南",
    studyGuide: "学习指南",
    section: "章节",
    learningObjective: "学习目标",
  },
  ja: {
    fullGuide: "完全な学習ガイド",
    studyGuide: "学習ガイド",
    section: "セクション",
    learningObjective: "学習目標",
  },
  ko: {
    fullGuide: "전체 학습 가이드",
    studyGuide: "학습 가이드",
    section: "섹션",
    learningObjective: "학습 목표",
  },
};

export type NarrationScript = {
  id: string;
  label: string;
  text: string;
  characters: number;
  withinLimit: boolean;
};

function sentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /[.!?…。！？：:]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function markdownToNarrationText(markdown: string): string {
  return markdown
    .replace(/^\s*```[^\n]*\n?/gm, "")
    .replace(/^\s*~~~[^\n]*\n?/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/[*_~`]/g, "")
    .split(/\n+/)
    .map((line) => sentence(line.replace(/\s+/g, " ")))
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function createScript(
  id: string,
  label: string,
  pieces: readonly string[],
  maxCharacters: number,
): NarrationScript {
  const text = pieces
    .map((piece) => markdownToNarrationText(piece))
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    id,
    label,
    text,
    characters: text.length,
    withinLimit: text.length > 0 && text.length <= maxCharacters,
  };
}

export function buildNarrationScripts(
  analysis: HydratedAnalysis,
  maxCharacters: number,
  outputLanguage: OutputLanguage = "en",
): NarrationScript[] {
  const labels = NARRATION_LABELS[outputLanguage];
  const sectionPieces = analysis.enhancedNotes.sections.map((section, index) => [
    `${labels.section} ${index + 1}. ${section.heading}`,
    `${labels.learningObjective}. ${section.learningObjective}`,
    section.markdown,
  ]);
  const full = createScript(
    "full",
    labels.fullGuide,
    [
      `${labels.studyGuide}. ${analysis.enhancedNotes.title}`,
      analysis.enhancedNotes.overview,
      ...sectionPieces.flat(),
    ],
    maxCharacters,
  );
  const sections = analysis.enhancedNotes.sections.map((section, index) =>
    createScript(
      section.id,
      `${labels.section} ${index + 1} · ${section.heading}`,
      [
        `${labels.studyGuide}. ${analysis.enhancedNotes.title}`,
        ...(sectionPieces[index] ?? []),
      ],
      maxCharacters,
    ),
  );

  return [full, ...sections];
}
