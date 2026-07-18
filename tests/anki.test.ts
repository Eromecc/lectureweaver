import { describe, expect, it } from "vitest";

import { ModelAnalysisSchema, type SourceChunk } from "@/domain";
import {
  generateAnkiImportText,
  hydrateAnalysis,
} from "@/lib/analysis";

import { buildTestAnalysis } from "./analysis-fixtures";

const chunks: SourceChunk[] = [
  {
    id: "slides:p0001:c01",
    sourceType: "slides",
    sourceName: "lecture<script>.pdf",
    locator: "Page 1",
    text: "Retrieval requires producing an answer before checking it.",
  },
  {
    id: "notes:p0001:c01",
    sourceType: "notes",
    sourceName: "notes.md",
    locator: "Paragraph 1",
    text: "Retrieve before reviewing.",
  },
];

function analysisWithCard(front: string, back: string) {
  const base = buildTestAnalysis(
    [
      {
        id: "retrieval",
        title: "Retrieval practice",
        importance: "core",
        status: "covered",
        explanation: "The notes preserve retrieval practice.",
        evidenceRefs: [
          { chunkId: "slides:p0001:c01", relevance: "Defines retrieval." },
          { chunkId: "notes:p0001:c01", relevance: "Preserves retrieval." },
        ],
      },
    ],
    { includeAnki: true },
  );

  return ModelAnalysisSchema.parse({
    ...base,
    ankiCards: [
      {
        ...base.ankiCards[0],
        front,
        back,
      },
    ],
  });
}

function parseQuotedTsvRow(row: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];
    if (character === '"') {
      if (quoted && row[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "\t" && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

describe("Anki text export", () => {
  it("emits deterministic Anki metadata, three quoted fields, and a final LF", () => {
    const hydrated = hydrateAnalysis(
      analysisWithCard('What\tis "retrieval"?', "Produce it.\r\nThen check <script>."),
      chunks,
      { ankiCards: true },
    );

    const exported = generateAnkiImportText(hydrated);
    const lines = exported.trimEnd().split("\n");

    expect(lines.slice(0, 4)).toEqual([
      "#separator:tab",
      "#html:true",
      "#columns:Front\tBack\tTags",
      "#tags column:3",
    ]);
    expect(lines).toHaveLength(5);
    const fields = parseQuotedTsvRow(lines[4] ?? "");
    expect(fields).toHaveLength(3);
    expect(fields[0]).toBe("What\tis &quot;retrieval&quot;?");
    expect(fields[1]).toContain("Produce it.<br>Then check &lt;script&gt;.");
    expect(fields[1]).toContain("lecture&lt;script&gt;.pdf · Page 1");
    expect(fields[2]).toBe(
      "lectureweaver lectureweaver::importance::core lectureweaver::status::covered",
    );
    expect(exported).not.toContain("<script>");
    expect(exported.startsWith("\uFEFF")).toBe(false);
    expect(exported.endsWith("\n")).toBe(true);
    expect(generateAnkiImportText(hydrated)).toBe(exported);
  });

  it("returns only import metadata when card generation is disabled", () => {
    const analysis = buildTestAnalysis(
      [
        {
          id: "retrieval",
          title: "Retrieval practice",
          importance: "core",
          status: "covered",
          explanation: "The notes preserve retrieval practice.",
          evidenceRefs: [
            { chunkId: "slides:p0001:c01", relevance: "Defines retrieval." },
            { chunkId: "notes:p0001:c01", relevance: "Preserves retrieval." },
          ],
        },
      ],
      { includeAnki: false },
    );
    const exported = generateAnkiImportText(
      hydrateAnalysis(analysis, chunks, { ankiCards: false }),
    );

    expect(exported).toBe(
      "#separator:tab\n#html:true\n#columns:Front\tBack\tTags\n#tags column:3\n",
    );
  });
});
