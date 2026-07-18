import {
  buildNarrationScripts,
  hydrateAnalysis,
  markdownToNarrationText,
} from "@/lib/analysis";
import { describe, expect, it } from "vitest";

import { buildTestAnalysis } from "./analysis-fixtures";

const chunks = [
  {
    id: "slides:p0001:c01",
    sourceType: "slides" as const,
    sourceName: "slides.pdf",
    locator: "Page 1",
    text: "Retrieval practice requires recall.",
  },
  {
    id: "notes:p0001:c01",
    sourceType: "notes" as const,
    sourceName: "notes.md",
    locator: "Paragraph 1",
    text: "Retrieval is in the notes.",
  },
];

describe("audio study-guide narration", () => {
  it("removes Markdown controls without discarding the prose", () => {
    expect(
      markdownToNarrationText(
        "## Heading\n\n- **First** idea\n- `Second` idea\n\n> Remember this",
      ),
    ).toBe("Heading. First idea. Second idea. Remember this.");
  });

  it("builds deterministic full and per-section scripts", () => {
    const analysis = buildTestAnalysis([
      {
        id: "retrieval",
        title: "Retrieval practice",
        importance: "core",
        status: "covered",
        explanation: "The notes preserve the definition.",
        evidenceRefs: [
          { chunkId: "slides:p0001:c01", relevance: "Defines retrieval." },
          { chunkId: "notes:p0001:c01", relevance: "Preserves retrieval." },
        ],
      },
    ]);
    const hydrated = hydrateAnalysis(analysis, chunks);
    const scripts = buildNarrationScripts(hydrated, 4_096);

    expect(scripts.map((script) => script.label)).toEqual([
      "Full study guide",
      "Section 1 · Retrieval practice",
    ]);
    expect(scripts[0]?.text).toContain("Study guide. Synthetic enhanced notes.");
    expect(scripts[0]?.text).toContain("Section 1. Retrieval practice.");
    expect(scripts.every((script) => script.withinLimit)).toBe(true);
  });

  it("localizes deterministic narration structure in Chinese", () => {
    const analysis = buildTestAnalysis([
      {
        id: "retrieval",
        title: "Retrieval practice",
        importance: "core",
        status: "covered",
        explanation: "The notes preserve the definition.",
        evidenceRefs: [
          { chunkId: "slides:p0001:c01", relevance: "Defines retrieval." },
          { chunkId: "notes:p0001:c01", relevance: "Preserves retrieval." },
        ],
      },
    ]);
    const hydrated = hydrateAnalysis(analysis, chunks);
    const scripts = buildNarrationScripts(hydrated, 4_096, "zh-CN");

    expect(scripts.map((script) => script.label)).toEqual([
      "完整学习指南",
      "章节 1 · Retrieval practice",
    ]);
    expect(scripts[0]?.text).toContain("学习指南. Synthetic enhanced notes.");
    expect(scripts[0]?.text).toContain("章节 1. Retrieval practice.");
    expect(scripts[0]?.text).toContain(
      "学习目标. Understand Retrieval practice.",
    );
    expect(scripts[0]?.text).not.toContain("Study guide.");
    expect(scripts[0]?.text).not.toContain("Section 1.");
  });

  it("marks oversized scripts unavailable instead of truncating them", () => {
    const analysis = buildTestAnalysis([
      {
        id: "retrieval",
        title: "Retrieval practice",
        importance: "core",
        status: "covered",
        explanation: "The notes preserve the definition.",
        evidenceRefs: [
          { chunkId: "slides:p0001:c01", relevance: "Defines retrieval." },
          { chunkId: "notes:p0001:c01", relevance: "Preserves retrieval." },
        ],
      },
    ]);
    const hydrated = hydrateAnalysis(analysis, chunks);
    const [full] = buildNarrationScripts(hydrated, 20);

    expect(full?.withinLimit).toBe(false);
    expect(full?.characters).toBe(full?.text.length);
    expect(full?.text.length).toBeGreaterThan(20);
  });
});
