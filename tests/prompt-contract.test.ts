import { describe, expect, it } from "vitest";

import type { SourceChunk } from "@/domain";
import {
  buildAnalysisInput,
  buildAnalysisInstructions,
} from "@/lib/ai/prompt";

const chunks: SourceChunk[] = [
  {
    id: "slides:p0001:c01",
    sourceType: "slides",
    sourceName: "lecture.pdf",
    locator: "Page 1",
    text: "Retrieval practice strengthens later recall.",
  },
  {
    id: "transcript:p0002-p0003:c01",
    sourceType: "transcript",
    sourceName: "transcript.txt",
    locator: "Paragraphs 2–3",
    text: "Spacing retrieval across several days improves retention.",
  },
  {
    id: "notes:p0001:c01",
    sourceType: "notes",
    sourceName: "notes.md",
    locator: "Paragraph 1",
    headingPath: ["Study strategies"],
    text: "Quiz yourself after studying.",
  },
];

function jsonLineAfter(input: string, label: string): unknown {
  const lines = input.split("\n");
  const labelIndex = lines.indexOf(label);
  if (labelIndex < 0 || lines[labelIndex + 1] === undefined) {
    throw new Error(`Prompt section not found: ${label}`);
  }
  return JSON.parse(lines[labelIndex + 1]) as unknown;
}

describe("analysis prompt relationship contract", () => {
  it("states the complete status, patch, section, and evidence matrix", () => {
    const instructions = buildAnalysisInstructions({ ankiCards: false });

    expect(instructions).toContain(
      "covered -> suggestedPatch null; enhanced-note changeType preserved",
    );
    expect(instructions).toContain(
      "partial -> suggestedPatch nonblank Markdown; enhanced-note changeType expanded",
    );
    expect(instructions).toContain(
      "missing -> suggestedPatch nonblank Markdown; enhanced-note changeType new",
    );
    expect(instructions).toContain(
      "contradiction -> suggestedPatch nonblank Markdown; enhanced-note changeType corrected",
    );
    expect(instructions).toContain(
      "assessment and section evidence each need at least one lecture reference and one notes reference",
    );
    expect(instructions).toContain(
      "assessment and section evidence each need at least one lecture reference; notes evidence is optional",
    );
  });

  it("aligns assessment and section limits and prevents mixed-status links", () => {
    const instructions = buildAnalysisInstructions({ ankiCards: true });

    expect(instructions).toContain("at most 10 assessments");
    expect(instructions).toContain("at most 10 enhancedNotes sections");
    expect(instructions).toContain("create one section per assessment");
    expect(instructions).toContain(
      "only when all linked assessments have the same status",
    );
    expect(instructions).toContain(
      "Never mix assessment statuses in one section",
    );
    expect(instructions).toContain(
      "Every card must contain exactly one assessment ID",
    );
  });

  it("lists exact lecture and notes chunk IDs separately", () => {
    const input = buildAnalysisInput(chunks, { ankiCards: false });

    expect(
      jsonLineAfter(
        input,
        "Allowed lecture chunk IDs (slides or transcript; copy exact values only):",
      ),
    ).toEqual(["slides:p0001:c01", "transcript:p0002-p0003:c01"]);
    expect(
      jsonLineAfter(
        input,
        "Allowed notes chunk IDs (copy exact values only; an empty array means notes are absent):",
      ),
    ).toEqual(["notes:p0001:c01"]);
  });

  it("makes the no-notes contract and empty notes inventory explicit", () => {
    const instructions = buildAnalysisInstructions({ ankiCards: false });
    const input = buildAnalysisInput(chunks.slice(0, 2), {
      ankiCards: false,
    });

    expect(instructions).toContain(
      "If no notes chunks are supplied, use only missing assessments and new enhanced-note sections",
    );
    expect(
      jsonLineAfter(
        input,
        "Allowed notes chunk IDs (copy exact values only; an empty array means notes are absent):",
      ),
    ).toEqual([]);
    expect(input).toContain('"status":"missing"');
    expect(input).toContain('"changeType":"new"');
  });

  it("preserves the selected language instruction", () => {
    expect(
      buildAnalysisInstructions({ ankiCards: false }, "zh-CN"),
    ).toContain(
      "Write every generated human-readable field in Simplified Chinese (zh-CN)",
    );
  });
});
