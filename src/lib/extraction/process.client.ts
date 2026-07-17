import { chunkMarkdownNotes, chunkPdfPages, chunkTranscript } from "./chunking";
import {
  assertExtractedTextLimit,
  assertProcessedSources,
  readNotesFile,
  readTranscriptFile,
  validatePdfFile,
} from "./files";
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
