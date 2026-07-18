import type { SourceChunk, SourceType } from "@/domain";
import { describe, expect, it } from "vitest";
import {
  FILE_LIMITS,
  LECTURE_TEXT_FILE_LIMIT,
  MAX_EXTRACTED_CHARACTERS,
  MAX_SOURCE_CHUNKS,
  SourceProcessingError,
  assertExtractedTextLimit,
  assertProcessedSources,
  chunkLectureText,
  chunkMarkdownNotes,
  chunkPdfPages,
  chunkTranscript,
  normalizeChunkText,
  normalizeSourceText,
  parseMarkdownBlocks,
  processSourceFiles,
  processSourceFilesWithTranscriptChunks,
  readLectureTextFile,
  readNotesFile,
  readTranscriptFile,
  splitOversizedText,
  validatePdfFile,
} from "@/lib/extraction";

function sourceChunk(
  sourceType: SourceType,
  index: number,
  text = "usable source text",
): SourceChunk {
  return {
    id: `${sourceType}:p${String(index).padStart(4, "0")}:c01`,
    sourceType,
    sourceName: `${sourceType}.txt`,
    locator: `Paragraph ${index}`,
    text,
  };
}

describe("source normalization", () => {
  it("normalizes BOM, CRLF, Unicode, nonbreaking spaces, and excess whitespace", () => {
    const input =
      "\uFEFFCafe\u0301\u00a0notes\u200b  \r\nnext\tline  \r\n\r\n\r\nfinal\r";

    expect(normalizeSourceText(input)).toBe("Café notes\nnext line\n\nfinal");
    expect(normalizeChunkText(input)).toBe("Café notes next line final");
  });

  it("is stable when normalization is applied repeatedly", () => {
    const once = normalizeSourceText("  α\u0301\r\n\r\n  β\tγ  ");
    expect(normalizeSourceText(once)).toBe(once);
  });
});

describe("Markdown structure", () => {
  it("tracks ATX and Setext heading transitions", () => {
    const blocks = parseMarkdownBlocks(`
# Study science

Overview.

## Retrieval

Recall first.

Spacing
-------

Wait between sessions.

# Practice

Mix problem types.
`);

    expect(blocks).toEqual([
      {
        ordinal: 1,
        text: "Overview.",
        headingPath: ["Study science"],
      },
      {
        ordinal: 2,
        text: "Recall first.",
        headingPath: ["Study science", "Retrieval"],
      },
      {
        ordinal: 3,
        text: "Wait between sessions.",
        headingPath: ["Study science", "Spacing"],
      },
      {
        ordinal: 4,
        text: "Mix problem types.",
        headingPath: ["Practice"],
      },
    ]);
  });

  it("does not treat heading syntax inside fenced code as headings", () => {
    const blocks = parseMarkdownBlocks(`
# Real heading

Before.

\`\`\`\`markdown
# Not a heading
Not Setext
---
\`\`\` this shorter fence does not close the block
## Still code
\`\`\`\`

After code.

## C# examples ###

Actual section.
`);

    expect(blocks).toHaveLength(4);
    expect(blocks[1]).toMatchObject({
      headingPath: ["Real heading"],
    });
    expect(blocks[1]?.text).toContain("# Not a heading");
    expect(blocks[1]?.text).toContain("## Still code");
    expect(blocks[2]).toEqual({
      ordinal: 3,
      text: "After code.",
      headingPath: ["Real heading"],
    });
    expect(blocks[3]).toEqual({
      ordinal: 4,
      text: "Actual section.",
      headingPath: ["Real heading", "C# examples"],
    });
  });

  it("copies the active heading hierarchy into notes chunks", () => {
    const chunks = chunkMarkdownNotes(
      "# Course\r\n\r\nIntro.\r\n\r\n## Retrieval\r\n\r\nRecall.\r\n\r\nTest yourself.",
      "notes.md",
      40,
    );

    expect(chunks).toEqual([
      {
        id: "notes:p0001:c01",
        sourceType: "notes",
        sourceName: "notes.md",
        locator: "Paragraph 1",
        headingPath: ["Course"],
        text: "Intro.",
      },
      {
        id: "notes:p0002-p0003:c01",
        sourceType: "notes",
        sourceName: "notes.md",
        locator: "Paragraphs 2-3",
        headingPath: ["Course", "Retrieval"],
        text: "Recall. Test yourself.",
      },
    ]);
  });
});

describe("source chunking and trusted locators", () => {
  it("creates stable page-scoped PDF chunks and skips textless pages", () => {
    const pages = [
      { pageNumber: 1, text: "  Retrieval\r\npractice  " },
      { pageNumber: 2, text: " \r\n " },
      { pageNumber: 10, text: "A very long page sentence. Another useful sentence." },
    ];

    const first = chunkPdfPages(pages, "lecture.pdf", 28);
    const second = chunkPdfPages(pages, "lecture.pdf", 28);

    expect(second).toEqual(first);
    expect(first[0]).toEqual({
      id: "slides:p0001:c01",
      sourceType: "slides",
      sourceName: "lecture.pdf",
      locator: "Page 1",
      text: "Retrieval practice",
    });
    expect(first.slice(1).map(({ id, locator }) => ({ id, locator }))).toEqual([
      { id: "slides:p0010:c01", locator: "Page 10" },
      { id: "slides:p0010:c02", locator: "Page 10" },
    ]);
    expect(first.every((chunk) => chunk.text.length <= 28)).toBe(true);
  });

  it("numbers transcript paragraphs after CRLF normalization and preserves ranges", () => {
    const transcript = "Alpha.\r\n\r\nBeta.\r\n\r\nGamma.";
    const chunks = chunkTranscript(transcript, "transcript.txt", 13);

    expect(chunks).toEqual([
      {
        id: "transcript:p0001-p0002:c01",
        sourceType: "transcript",
        sourceName: "transcript.txt",
        locator: "Paragraphs 1-2",
        text: "Alpha. Beta.",
      },
      {
        id: "transcript:p0003:c01",
        sourceType: "transcript",
        sourceName: "transcript.txt",
        locator: "Paragraph 3",
        text: "Gamma.",
      },
    ]);
    expect(chunkTranscript(transcript, "transcript.txt", 13)).toEqual(chunks);
  });

  it("creates stable paragraph-scoped slide chunks from lecture text", () => {
    const lecture = "Retrieval practice.\r\n\r\nSpace reviews.\r\n\r\nMix examples.";
    const first = chunkLectureText(lecture, "lecture.txt", 40);

    expect(first).toEqual([
      {
        id: "slides:p0001-p0002:c01",
        sourceType: "slides",
        sourceName: "lecture.txt",
        locator: "Paragraphs 1-2",
        text: "Retrieval practice. Space reviews.",
      },
      {
        id: "slides:p0003:c01",
        sourceType: "slides",
        sourceName: "lecture.txt",
        locator: "Paragraph 3",
        text: "Mix examples.",
      },
    ]);
    expect(chunkLectureText(lecture, "lecture.txt", 40)).toEqual(first);
  });

  it("splits oversized lecture-text paragraphs without losing content", () => {
    const chunks = chunkLectureText("abcdefghijklmnopqrstuv", "lecture.txt", 10);

    expect(chunks.map(({ id, locator, text }) => ({ id, locator, text }))).toEqual([
      { id: "slides:p0001:c01", locator: "Paragraph 1", text: "abcdefghij" },
      { id: "slides:p0001:c02", locator: "Paragraph 1", text: "klmnopqrst" },
      { id: "slides:p0001:c03", locator: "Paragraph 1", text: "uv" },
    ]);
    expect(chunks.map((chunk) => chunk.text).join("")).toBe(
      "abcdefghijklmnopqrstuv",
    );
  });

  it("splits an oversized paragraph without truncating it", () => {
    const chunks = chunkTranscript(
      "abcdefghijklmnopqrstuv\n\ntail",
      "transcript.txt",
      10,
    );

    expect(chunks.slice(0, 3).map(({ id, locator, text }) => ({ id, locator, text }))).toEqual([
      {
        id: "transcript:p0001:c01",
        locator: "Paragraph 1",
        text: "abcdefghij",
      },
      {
        id: "transcript:p0001:c02",
        locator: "Paragraph 1",
        text: "klmnopqrst",
      },
      {
        id: "transcript:p0001:c03",
        locator: "Paragraph 1",
        text: "uv",
      },
    ]);
    expect(chunks[3]?.id).toBe("transcript:p0002:c01");
    expect(chunks.slice(0, 3).map((chunk) => chunk.text).join("")).toBe(
      "abcdefghijklmnopqrstuv",
    );
  });

  it("keeps Unicode scalar values intact at chunk boundaries", () => {
    const source = "1234😀5678 café retrieval practice";
    const pieces = splitOversizedText(source, 9);

    expect(pieces.every((piece) => piece.length <= 9)).toBe(true);
    expect(pieces.join(" ")).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(pieces.join(" ")).not.toMatch(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    expect(pieces.join("").replace(/\s/g, "")).toBe(source.replace(/\s/g, ""));
  });
});

describe("file validation", () => {
  it("accepts a PDF only when extension, MIME type, and signature agree", async () => {
    await expect(
      validatePdfFile(
        new File(["%PDF-1.7\n"], "lecture.PDF", { type: "application/pdf" }),
      ),
    ).resolves.toBeUndefined();

    await expect(
      validatePdfFile(new File(["%PDF-1.7"], "lecture.txt", { type: "text/plain" })),
    ).rejects.toMatchObject({ code: "invalid_file_type", sourceType: "slides" });
    await expect(
      validatePdfFile(new File(["not a pdf"], "lecture.pdf", { type: "application/pdf" })),
    ).rejects.toMatchObject({ code: "invalid_pdf", sourceType: "slides" });
  });

  it("accepts supported text extensions and rejects invalid UTF-8 or binary text", async () => {
    await expect(
      readLectureTextFile(new File(["Lecture text"], "lecture.TXT", { type: "text/plain" })),
    ).resolves.toBe("Lecture text");
    await expect(
      readTranscriptFile(new File(["Café"], "lecture.txt", { type: "text/plain" })),
    ).resolves.toBe("Café");
    await expect(
      readNotesFile(new File(["# Notes"], "notes.markdown", { type: "text/markdown" })),
    ).resolves.toBe("# Notes");

    await expect(
      readTranscriptFile(
        new File([new Uint8Array([0xc3, 0x28])], "lecture.txt", {
          type: "text/plain",
        }),
      ),
    ).rejects.toMatchObject({ code: "invalid_encoding", sourceType: "transcript" });
    await expect(
      readNotesFile(new File(["valid\u0000binary"], "notes.md", { type: "text/plain" })),
    ).rejects.toMatchObject({ code: "binary_text", sourceType: "notes" });
    await expect(
      readLectureTextFile(
        new File([new Uint8Array([0xc3, 0x28])], "lecture.txt", {
          type: "text/plain",
        }),
      ),
    ).rejects.toMatchObject({ code: "invalid_encoding", sourceType: "slides" });
    await expect(
      readLectureTextFile(
        new File(["valid\u0000binary"], "lecture.txt", { type: "text/plain" }),
      ),
    ).rejects.toMatchObject({ code: "binary_text", sourceType: "slides" });
  });

  it("rejects mismatched MIME types, extensions, and oversized text files", async () => {
    await expect(
      readTranscriptFile(new File(["text"], "lecture.md", { type: "text/plain" })),
    ).rejects.toMatchObject({ code: "invalid_file_type", sourceType: "transcript" });
    await expect(
      readNotesFile(new File(["text"], "notes.md", { type: "application/json" })),
    ).rejects.toMatchObject({ code: "invalid_file_type", sourceType: "notes" });
    await expect(
      readLectureTextFile(new File(["text"], "lecture.md", { type: "text/plain" })),
    ).rejects.toMatchObject({ code: "invalid_file_type", sourceType: "slides" });
    await expect(
      readLectureTextFile(
        new File(["text"], "lecture.txt", { type: "application/pdf" }),
      ),
    ).rejects.toMatchObject({ code: "invalid_file_type", sourceType: "slides" });

    const oversized = new File(["x".repeat(FILE_LIMITS.notes + 1)], "notes.md", {
      type: "text/markdown",
    });
    await expect(readNotesFile(oversized)).rejects.toMatchObject({
      code: "file_too_large",
      sourceType: "notes",
    });

    const oversizedLectureText = new File(
      ["x".repeat(LECTURE_TEXT_FILE_LIMIT + 1)],
      "lecture.txt",
      { type: "text/plain" },
    );
    await expect(readLectureTextFile(oversizedLectureText)).rejects.toMatchObject({
      code: "file_too_large",
      sourceType: "slides",
    });

    const exactBoundary = new File(
      ["x".repeat(LECTURE_TEXT_FILE_LIMIT)],
      "lecture.txt",
      { type: "text/plain" },
    );
    await expect(readLectureTextFile(exactBoundary)).resolves.toHaveLength(
      LECTURE_TEXT_FILE_LIMIT,
    );
  });
});

describe("lecture-text source processing", () => {
  const lecture = new File(
    ["Retrieval practice checks memory.\r\n\r\nSpacing strengthens retention."],
    "lecture.txt",
    { type: "text/plain" },
  );
  const notes = new File(["# Notes\n\nRecall from memory."], "notes.md", {
    type: "text/markdown",
  });

  it("processes a TXT lecture through the standard three-file pipeline", async () => {
    const processed = await processSourceFiles({
      slides: lecture,
      transcript: new File(["The lecturer explains spacing."], "transcript.txt", {
        type: "text/plain",
      }),
      notes,
    });

    expect(processed.counts).toEqual({ slides: 1, transcript: 1, notes: 1 });
    expect(processed.chunks[0]).toEqual({
      id: "slides:p0001-p0002:c01",
      sourceType: "slides",
      sourceName: "lecture.txt",
      locator: "Paragraphs 1-2",
      text: "Retrieval practice checks memory. Spacing strengthens retention.",
    });
  });

  it("processes a TXT lecture with trusted timestamped transcript chunks", async () => {
    const transcriptChunk: SourceChunk = {
      id: "transcript:t000000000-t000005000:c01",
      sourceType: "transcript",
      sourceName: "recording.mp3",
      locator: "00:00–00:05",
      text: "Speaker A: Retrieval practice checks memory.",
    };

    const processed = await processSourceFilesWithTranscriptChunks(
      { slides: lecture, notes },
      [transcriptChunk],
    );

    expect(processed.counts).toEqual({ slides: 1, transcript: 1, notes: 1 });
    expect(processed.chunks).toContainEqual(transcriptChunk);
    expect(processed.chunks[0]?.id).toBe("slides:p0001-p0002:c01");
  });
});

describe("global extraction limits", () => {
  it("enforces the normalized character cap without truncation", () => {
    expect(assertExtractedTextLimit(["x".repeat(MAX_EXTRACTED_CHARACTERS)])).toBe(
      MAX_EXTRACTED_CHARACTERS,
    );
    expect(() =>
      assertExtractedTextLimit(["x".repeat(MAX_EXTRACTED_CHARACTERS + 1)]),
    ).toThrowError(SourceProcessingError);

    try {
      assertExtractedTextLimit(["x".repeat(MAX_EXTRACTED_CHARACTERS + 1)]);
    } catch (error: unknown) {
      expect(error).toMatchObject({ code: "text_limit_exceeded" });
    }
  });

  it("enforces the total chunk cap while accepting the exact boundary", () => {
    const required = [sourceChunk("transcript", 1), sourceChunk("notes", 1)];
    const atLimit = [
      ...Array.from({ length: MAX_SOURCE_CHUNKS - required.length }, (_, index) =>
        sourceChunk("slides", index + 1),
      ),
      ...required,
    ];

    expect(assertProcessedSources(atLimit).chunks).toHaveLength(MAX_SOURCE_CHUNKS);
    expect(() =>
      assertProcessedSources([...atLimit, sourceChunk("slides", MAX_SOURCE_CHUNKS + 1)]),
    ).toThrowError(SourceProcessingError);

    try {
      assertProcessedSources([...atLimit, sourceChunk("slides", MAX_SOURCE_CHUNKS + 1)]);
    } catch (error: unknown) {
      expect(error).toMatchObject({ code: "chunk_limit_exceeded" });
    }
  });

  it("rejects an empty source map for any required source", () => {
    expect(() =>
      assertProcessedSources([
        sourceChunk("slides", 1),
        sourceChunk("transcript", 1),
      ]),
    ).toThrowError(/No usable text was found in the notes file/);
  });
});
