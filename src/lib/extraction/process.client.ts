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
import type { ProcessedSources, SourceFiles } from "./files";
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

export async function processSourceFiles(files: SourceFiles): Promise<ProcessedSources> {
  const [lecture, transcript, notes] = await Promise.all([
    processLectureSource(files.slides),
    readTranscriptFile(files.transcript),
    readNotesFile(files.notes),
  ]);

  assertExtractedTextLimit([
    ...lecture.extractedText,
    transcript,
    notes,
  ]);

  return assertProcessedSources([
    ...lecture.chunks,
    ...chunkTranscript(transcript, files.transcript.name),
    ...chunkMarkdownNotes(notes, files.notes.name),
  ]);
}

export async function processSourceFilesWithTranscriptChunks(
  files: Pick<SourceFiles, "slides" | "notes">,
  transcriptChunks: readonly SourceChunk[],
): Promise<ProcessedSources> {
  const [lecture, notes] = await Promise.all([
    processLectureSource(files.slides),
    readNotesFile(files.notes),
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
    ...lecture.extractedText,
    ...transcriptChunks.map((chunk) => chunk.text),
    notes,
  ]);

  return assertProcessedSources([
    ...lecture.chunks,
    ...transcriptChunks,
    ...chunkMarkdownNotes(notes, files.notes.name),
  ]);
}
