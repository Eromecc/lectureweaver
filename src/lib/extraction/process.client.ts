import type { SourceChunk } from "@/domain";

import {
  chunkLectureText,
  chunkMarkdownNotes,
  chunkPdfPages,
  chunkTranscript,
} from "./chunking";
import {
  assertExtractedTextLimit,
  assertProcessedSources,
  readLectureTextFile,
  readNotesFile,
  readTranscriptFile,
  validatePdfFile,
} from "./files";
import { SourceProcessingError } from "./errors";
import type {
  ProcessedSources,
  SourceFiles,
  SourceFileSelection,
} from "./files";
import { extractPdfPages } from "./pdf.client";

type ProcessedLectureSource = {
  chunks: SourceChunk[];
  extractedText: string[];
};

function hasPdfExtension(file: File): boolean {
  return file.name.toLowerCase().endsWith(".pdf");
}

async function processLectureSource(file: File): Promise<ProcessedLectureSource> {
  if (hasPdfExtension(file)) {
    await validatePdfFile(file);
    const pages = await extractPdfPages(file);
    return {
      chunks: chunkPdfPages(pages, file.name),
      extractedText: pages.map((page) => page.text),
    };
  }

  const text = await readLectureTextFile(file);
  return {
    chunks: chunkLectureText(text, file.name),
    extractedText: [text],
  };
}

export async function processSourceFiles(
  files: SourceFileSelection,
): Promise<ProcessedSources> {
  const [lecture, transcript, notes] = await Promise.all([
    files.slides === undefined
      ? Promise.resolve(null)
      : processLectureSource(files.slides),
    files.transcript === undefined
      ? Promise.resolve(null)
      : readTranscriptFile(files.transcript),
    files.notes === undefined
      ? Promise.resolve(null)
      : readNotesFile(files.notes),
  ]);

  assertExtractedTextLimit([
    ...(lecture?.extractedText ?? []),
    ...(transcript === null ? [] : [transcript]),
    ...(notes === null ? [] : [notes]),
  ]);

  return assertProcessedSources([
    ...(lecture?.chunks ?? []),
    ...(transcript === null || files.transcript === undefined
      ? []
      : chunkTranscript(transcript, files.transcript.name)),
    ...(notes === null || files.notes === undefined
      ? []
      : chunkMarkdownNotes(notes, files.notes.name)),
  ]);
}

export async function processSourceFilesWithTranscriptChunks(
  files: Partial<Pick<SourceFiles, "slides" | "notes">>,
  transcriptChunks: readonly SourceChunk[],
): Promise<ProcessedSources> {
  const [lecture, notes] = await Promise.all([
    files.slides === undefined
      ? Promise.resolve(null)
      : processLectureSource(files.slides),
    files.notes === undefined
      ? Promise.resolve(null)
      : readNotesFile(files.notes),
  ]);

  if (
    transcriptChunks.length === 0 ||
    transcriptChunks.some((chunk) => chunk.sourceType !== "transcript")
  ) {
    throw new SourceProcessingError(
      "empty_source",
      "transcript",
      "The audio transcription did not contain usable spoken text.",
    );
  }

  assertExtractedTextLimit([
    ...(lecture?.extractedText ?? []),
    ...transcriptChunks.map((chunk) => chunk.text),
    ...(notes === null ? [] : [notes]),
  ]);

  return assertProcessedSources([
    ...(lecture?.chunks ?? []),
    ...transcriptChunks,
    ...(notes === null || files.notes === undefined
      ? []
      : chunkMarkdownNotes(notes, files.notes.name)),
  ]);
}
