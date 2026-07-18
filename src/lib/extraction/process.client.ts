import type { SourceChunk } from "@/domain";

import { chunkMarkdownNotes, chunkPdfPages, chunkTranscript } from "./chunking";
import {
  assertExtractedTextLimit,
  assertProcessedSources,
  readNotesFile,
  readTranscriptFile,
  validatePdfFile,
} from "./files";
import { SourceProcessingError } from "./errors";
import type { ProcessedSources, SourceFiles } from "./files";
import { extractPdfPages } from "./pdf.client";

export async function processSourceFiles(files: SourceFiles): Promise<ProcessedSources> {
  await validatePdfFile(files.slides);
  const [pages, transcript, notes] = await Promise.all([
    extractPdfPages(files.slides),
    readTranscriptFile(files.transcript),
    readNotesFile(files.notes),
  ]);

  assertExtractedTextLimit([
    ...pages.map((page) => page.text),
    transcript,
    notes,
  ]);

  return assertProcessedSources([
    ...chunkPdfPages(pages, files.slides.name),
    ...chunkTranscript(transcript, files.transcript.name),
    ...chunkMarkdownNotes(notes, files.notes.name),
  ]);
}

export async function processSourceFilesWithTranscriptChunks(
  files: Pick<SourceFiles, "slides" | "notes">,
  transcriptChunks: readonly SourceChunk[],
): Promise<ProcessedSources> {
  await validatePdfFile(files.slides);
  const [pages, notes] = await Promise.all([
    extractPdfPages(files.slides),
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
    ...pages.map((page) => page.text),
    ...transcriptChunks.map((chunk) => chunk.text),
    notes,
  ]);

  return assertProcessedSources([
    ...chunkPdfPages(pages, files.slides.name),
    ...transcriptChunks,
    ...chunkMarkdownNotes(notes, files.notes.name),
  ]);
}
