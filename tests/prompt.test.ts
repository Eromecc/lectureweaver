import { describe, expect, it } from "vitest";

import type { SourceChunk } from "@/domain";
import {
  buildAnalysisInput,
  buildAnalysisInstructions,
} from "@/lib/ai/prompt";
import {
  MAX_MODEL_OUTPUT_TOKENS_WITH_ANKI,
  MAX_MODEL_OUTPUT_TOKENS_WITHOUT_ANKI,
  modelOutputTokenLimit,
} from "@/lib/ai/generation-limits";

const sourceChunks: SourceChunk[] = [
  {
    id: "slides:p0001:c01",
    sourceType: "slides",
    sourceName: "private-lecture-name.pdf",
    locator: "Private locator 1",
    text: "Spacing distributes study over time.",
  },
  {
    id: "notes:p0002:c01",
    sourceType: "notes",
    sourceName: "private-notes-name.md",
    locator: "Private locator 2",
    headingPath: ["Study plan", "Spacing"],
    text: "Review material on several days.",
  },
];

describe("analysis prompt", () => {
  it("reserves a bounded increment only when Anki output is requested", () => {
    expect(modelOutputTokenLimit({ ankiCards: false })).toBe(
      MAX_MODEL_OUTPUT_TOKENS_WITHOUT_ANKI,
    );
    expect(modelOutputTokenLimit({ ankiCards: true })).toBe(
      MAX_MODEL_OUTPUT_TOKENS_WITH_ANKI,
    );
    expect(MAX_MODEL_OUTPUT_TOKENS_WITHOUT_ANKI).toBe(8_000);
    expect(MAX_MODEL_OUTPUT_TOKENS_WITH_ANKI).toBe(10_000);
  });

  it("sets concise generation budgets while retaining core coverage", () => {
    const withAnki = buildAnalysisInstructions({ ankiCards: true });

    expect(withAnki).toContain("at most 10 assessments");
    expect(withAnki).toContain("never omit a core concept");
    expect(withAnki).toContain("at most 10 enhancedNotes sections");
    expect(withAnki).toContain("at or below 7,000 characters");
    expect(withAnki).toContain("at or below 1,000 characters");
    expect(withAnki).toContain("at most 12 Anki cards");
    expect(withAnki).toContain("every core assessment");

    const withoutAnki = buildAnalysisInstructions({ ankiCards: false });
    expect(withoutAnki).toContain("Return an empty ankiCards array");
    expect(withoutAnki).not.toContain("Generate at most 12 Anki cards");
  });

  it("sends only model-required source fields while preserving IDs and headings", () => {
    const input = buildAnalysisInput(sourceChunks, { ankiCards: false });
    const serializedChunks = input.split("Trusted source chunks:\n")[1];

    expect(serializedChunks).toBeDefined();
    expect(JSON.parse(serializedChunks!)).toEqual([
      {
        id: "slides:p0001:c01",
        sourceType: "slides",
        text: "Spacing distributes study over time.",
      },
      {
        id: "notes:p0002:c01",
        sourceType: "notes",
        headingPath: ["Study plan", "Spacing"],
        text: "Review material on several days.",
      },
    ]);
    expect(input).not.toContain('"sourceName"');
    expect(input).not.toContain('"locator"');
    expect(input).not.toContain("private-lecture-name.pdf");
    expect(input).not.toContain("Private locator 2");
  });
});
