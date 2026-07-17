import { describe, expect, it } from "vitest";

import type {
  AssessmentStatus,
  ConceptAssessment,
  ModelAnalysis,
  SourceChunk,
} from "@/domain";
import {
  AnalysisSemanticError,
  generateMarkdownPatch,
  hydrateAnalysis,
} from "@/lib/analysis";

const sourceChunks: SourceChunk[] = [
  {
    id: "slides:p0001:c01",
    sourceType: "slides",
    sourceName: "lecture.pdf",
    locator: "Page 1",
    text: "Spacing distributes study sessions over time.",
  },
  {
    id: "transcript:p0001-p0002:c01",
    sourceType: "transcript",
    sourceName: "transcript.txt",
    locator: "Paragraphs 1–2",
    text: "Retrieval should be effortful but achievable.",
  },
  {
    id: "notes:p0001-p0002:c01",
    sourceType: "notes",
    sourceName: "notes.md",
    locator: "Paragraphs 1–2",
    headingPath: ["Study methods", "Spacing"],
    text: "Space each review session by one week.",
  },
];

function makeAssessment(
  id: string,
  status: AssessmentStatus,
  evidenceChunkIds: string[],
  importance: "core" | "supporting" = "core",
): ConceptAssessment {
  return {
    id,
    title: id,
    importance,
    status,
    explanation: `${id} explanation`,
    evidenceRefs: evidenceChunkIds.map((chunkId) => ({
      chunkId,
      relevance: `${chunkId} is relevant`,
    })),
    ...(status === "covered" ? {} : { suggestedPatch: `Patch for ${id}.` }),
  };
}

function analysisWith(assessment: ConceptAssessment): ModelAnalysis {
  return { summary: "Analysis summary", assessments: [assessment] };
}

describe("evidence validation and hydration", () => {
  it("hydrates all trusted display fields from freshly extracted chunks", () => {
    const hydrated = hydrateAnalysis(
      analysisWith(
        makeAssessment("spacing", "covered", [
          "slides:p0001:c01",
          "notes:p0001-p0002:c01",
        ]),
      ),
      sourceChunks,
    );

    expect(hydrated.assessments[0]?.evidence[1]).toMatchObject({
      chunkId: "notes:p0001-p0002:c01",
      relevance: "notes:p0001-p0002:c01 is relevant",
      chunk: {
        sourceName: "notes.md",
        locator: "Paragraphs 1–2",
        headingPath: ["Study methods", "Spacing"],
        text: "Space each review session by one week.",
      },
    });
  });

  it("rejects unknown and duplicate source chunk ids", () => {
    expect(() =>
      hydrateAnalysis(
        analysisWith(
          makeAssessment("unknown", "missing", ["slides:p9999:c01"]),
        ),
        sourceChunks,
      ),
    ).toThrow(AnalysisSemanticError);

    expect(() =>
      hydrateAnalysis(
        analysisWith(
          makeAssessment("spacing", "missing", ["slides:p0001:c01"]),
        ),
        [...sourceChunks, { ...sourceChunks[0] as SourceChunk }],
      ),
    ).toThrow("Duplicate source chunk id");
  });

  it.each([
    ["covered", ["slides:p0001:c01"], "from notes"],
    ["partial", ["notes:p0001-p0002:c01"], "slides or transcript"],
    ["missing", ["notes:p0001-p0002:c01"], "slides or transcript"],
    ["contradiction", ["slides:p0001:c01"], "from notes"],
  ] as const)(
    "enforces trusted evidence sources for %s assessments",
    (status, evidenceChunkIds, expectedMessage) => {
      expect(() =>
        hydrateAnalysis(
          analysisWith(
            makeAssessment("invalid-sources", status, [...evidenceChunkIds]),
          ),
          sourceChunks,
        ),
      ).toThrow(expectedMessage);
    },
  );

  it("orders Markdown by status then importance and emits trusted locators", () => {
    const analysis: ModelAnalysis = {
      summary: "Several additions are recommended.",
      assessments: [
        makeAssessment(
          "partial-supporting",
          "partial",
          ["slides:p0001:c01", "notes:p0001-p0002:c01"],
          "supporting",
        ),
        makeAssessment(
          "contradiction-core",
          "contradiction",
          ["transcript:p0001-p0002:c01", "notes:p0001-p0002:c01"],
        ),
        makeAssessment(
          "missing-supporting",
          "missing",
          ["slides:p0001:c01"],
          "supporting",
        ),
        makeAssessment(
          "missing-core",
          "missing",
          ["transcript:p0001-p0002:c01"],
        ),
      ],
    };

    const markdown = generateMarkdownPatch(
      hydrateAnalysis(analysis, sourceChunks),
    );

    expect(markdown.indexOf("### missing-core")).toBeLessThan(
      markdown.indexOf("### missing-supporting"),
    );
    expect(markdown.indexOf("## Missing concepts")).toBeLessThan(
      markdown.indexOf("## Partially covered concepts"),
    );
    expect(markdown.indexOf("## Partially covered concepts")).toBeLessThan(
      markdown.indexOf("## Possible contradictions"),
    );
    expect(markdown).toContain("lecture.pdf · Page 1");
    expect(markdown).toContain(
      "notes.md · Paragraphs 1–2 — Study methods › Spacing",
    );
    expect(markdown.endsWith("\n")).toBe(true);
  });

  it("returns no patch when every concept is covered", () => {
    const hydrated = hydrateAnalysis(
      analysisWith(
        makeAssessment("spacing", "covered", [
          "slides:p0001:c01",
          "notes:p0001-p0002:c01",
        ]),
      ),
      sourceChunks,
    );

    expect(generateMarkdownPatch(hydrated)).toBe("");
  });
});
