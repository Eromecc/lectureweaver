import type { HydratedAnalysis } from "./hydration";

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
): NarrationScript[] {
  const sectionPieces = analysis.enhancedNotes.sections.map((section, index) => [
    `Section ${index + 1}. ${section.heading}`,
    `Learning objective. ${section.learningObjective}`,
    section.markdown,
  ]);
  const full = createScript(
    "full",
    "Full study guide",
    [
      `Study guide. ${analysis.enhancedNotes.title}`,
      analysis.enhancedNotes.overview,
      ...sectionPieces.flat(),
    ],
    maxCharacters,
  );
  const sections = analysis.enhancedNotes.sections.map((section, index) =>
    createScript(
      section.id,
      `Section ${index + 1} · ${section.heading}`,
      [
        `Study guide. ${analysis.enhancedNotes.title}`,
        ...(sectionPieces[index] ?? []),
      ],
      maxCharacters,
    ),
  );

  return [full, ...sections];
}
