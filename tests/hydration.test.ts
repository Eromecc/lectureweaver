import { describe, expect, it } from "vitest";

import type {
  AssessmentStatus,
  ConceptAssessment,
  ModelAnalysis,
  SourceChunk,
} from "@/domain";
import {
  AnalysisSemanticError,
  generateEnhancedNotesMarkdown,
  generateMarkdownPatch,
  hydrateAnalysis,
} from "@/lib/analysis";

import { buildTestAnalysis } from "./analysis-fixtures";

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
  {
    id: "notes:p0003:c01",
    sourceType: "notes",
    sourceName: "notes.md",
    locator: "Paragraph 3",
    headingPath: ["Study methods", "Retrieval"],
    text: "Retrieve before checking the source.",
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
  return buildTestAnalysis([assessment], { summary: "Analysis summary" });
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
    expect(hydrated.enhancedNotes.sections[0]?.evidence[1]?.chunk).toMatchObject({
      sourceName: "notes.md",
      locator: "Paragraphs 1–2",
      text: "Space each review session by one week.",
    });
    const enhancedMarkdown = generateEnhancedNotesMarkdown(hydrated);
    expect(enhancedMarkdown).toContain("## Contents");
    expect(enhancedMarkdown).toContain("- [1. spacing](#1-spacing)");
    expect(enhancedMarkdown).toContain("## 1. spacing");
    expect(enhancedMarkdown).toContain(
      "notes.md · Paragraphs 1–2 — Study methods › Spacing",
    );
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

  it("builds missing/new study artifacts safely when no notes were supplied", () => {
    const primaryOnlyChunks = [sourceChunks[1]!];
    const hydrated = hydrateAnalysis(
      buildTestAnalysis(
        [
          makeAssessment(
            "retrieval",
            "missing",
            ["transcript:p0001-p0002:c01"],
          ),
        ],
        { includeAnki: true },
      ),
      primaryOnlyChunks,
    );

    expect(hydrated.assessments[0]?.status).toBe("missing");
    expect(hydrated.enhancedNotes.sections[0]?.changeType).toBe("new");
    expect(hydrated.enhancedNotes.sections[0]?.evidence[0]?.chunk.sourceType).toBe(
      "transcript",
    );
    expect(hydrated.ankiCards).toHaveLength(1);
  });

  it("orders Markdown by status then importance and emits trusted locators", () => {
    const assessments = [
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
      ];
    const analysis: ModelAnalysis = buildTestAnalysis(assessments, {
      summary: "Several additions are recommended.",
    });

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

  it("localizes deterministic enhanced-note and changes-only labels in Chinese", () => {
    const assessments = [
      makeAssessment("missing-core", "missing", ["slides:p0001:c01"]),
      makeAssessment("partial-core", "partial", [
        "slides:p0001:c01",
        "notes:p0001-p0002:c01",
      ]),
      makeAssessment("contradiction-core", "contradiction", [
        "transcript:p0001-p0002:c01",
        "notes:p0003:c01",
      ]),
    ];
    const hydrated = hydrateAnalysis(
      buildTestAnalysis(assessments, {
        summary: "Several additions are recommended.",
      }),
      sourceChunks,
    );

    const enhancedMarkdown = generateEnhancedNotesMarkdown(
      hydrated,
      "zh-CN",
    );
    const changesMarkdown = generateMarkdownPatch(hydrated, "zh-CN");

    expect(enhancedMarkdown).toContain("## 目录");
    expect(enhancedMarkdown).toContain("**学习目标:**");
    expect(enhancedMarkdown).toContain("> 证据: lecture.pdf · Page 1");
    expect(enhancedMarkdown).not.toContain("## Contents");
    expect(enhancedMarkdown).not.toContain("**Learning objective:**");

    expect(changesMarkdown).toContain("# 建议补充的笔记");
    expect(changesMarkdown).toContain("## 缺失概念");
    expect(changesMarkdown).toContain("## 覆盖不完整的概念");
    expect(changesMarkdown).toContain("## 可能的矛盾");
    expect(changesMarkdown).toContain("> 证据: lecture.pdf · Page 1");
    expect(changesMarkdown).not.toContain("# Suggested note additions");
    expect(changesMarkdown).not.toContain("> Evidence:");
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

  it("rejects artifact evidence outside linked assessments and notes-only cards", () => {
    const base = buildTestAnalysis(
      [
        makeAssessment("spacing", "covered", [
          "slides:p0001:c01",
          "notes:p0001-p0002:c01",
        ]),
      ],
      { includeAnki: true },
    );
    const unrelatedSectionEvidence: ModelAnalysis = {
      ...base,
      enhancedNotes: {
        ...base.enhancedNotes,
        sections: [
          {
            ...base.enhancedNotes.sections[0]!,
            evidenceRefs: [
              ...base.enhancedNotes.sections[0]!.evidenceRefs,
              {
                chunkId: "transcript:p0001-p0002:c01",
                relevance: "A real but unrelated chunk.",
              },
            ],
          },
        ],
      },
    };
    const notesOnlyCard: ModelAnalysis = {
      ...base,
      ankiCards: [
        {
          ...base.ankiCards[0]!,
          evidenceRefs: [
            {
              chunkId: "notes:p0001-p0002:c01",
              relevance: "Notes alone cannot ground a card.",
            },
          ],
        },
      ],
    };

    expect(() => hydrateAnalysis(unrelatedSectionEvidence, sourceChunks)).toThrow(
      "outside its linked assessments",
    );
    expect(() =>
      hydrateAnalysis(notesOnlyCard, sourceChunks, { ankiCards: true }),
    ).toThrow("requires evidence from slides or transcript");
  });

  it("enforces the requested Anki output and core-assessment coverage", () => {
    const assessment = makeAssessment("spacing", "covered", [
      "slides:p0001:c01",
      "notes:p0001-p0002:c01",
    ]);
    const withCards = buildTestAnalysis([assessment], { includeAnki: true });
    const withoutCards = buildTestAnalysis([assessment], { includeAnki: false });

    expect(() =>
      hydrateAnalysis(withCards, sourceChunks, { ankiCards: false }),
    ).toThrow("not requested");
    expect(() =>
      hydrateAnalysis(withoutCards, sourceChunks, { ankiCards: true }),
    ).toThrow("none were returned");
  });

  it("requires each linked artifact assessment to share its own trusted evidence", () => {
    const spacing = makeAssessment("spacing", "covered", [
      "slides:p0001:c01",
      "notes:p0001-p0002:c01",
    ]);
    const retrieval = makeAssessment("retrieval", "covered", [
      "transcript:p0001-p0002:c01",
      "notes:p0003:c01",
    ]);
    const base = buildTestAnalysis([spacing, retrieval], { includeAnki: true });
    const borrowedSectionEvidence: ModelAnalysis = {
      ...base,
      enhancedNotes: {
        ...base.enhancedNotes,
        sections: [
          {
            ...base.enhancedNotes.sections[0]!,
            assessmentIds: [spacing.id, retrieval.id],
            evidenceRefs: [
              spacing.evidenceRefs[0]!,
              retrieval.evidenceRefs[1]!,
            ],
          },
        ],
      },
    };
    const borrowedCardEvidence: ModelAnalysis = {
      ...base,
      ankiCards: [
        {
          ...base.ankiCards[0]!,
          assessmentIds: [spacing.id, retrieval.id],
          evidenceRefs: [spacing.evidenceRefs[0]!],
        },
      ],
    };

    expect(() => hydrateAnalysis(borrowedSectionEvidence, sourceChunks)).toThrow(
      "does not share notes evidence with assessment spacing",
    );
    expect(() =>
      hydrateAnalysis(borrowedCardEvidence, sourceChunks, { ankiCards: true }),
    ).toThrow(
      "does not share slides or transcript evidence with assessment retrieval",
    );
  });
});
