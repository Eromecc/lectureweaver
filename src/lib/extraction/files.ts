import type { SourceChunk, SourceType } from "@/domain";
import {
  FILE_LIMITS,
  LECTURE_TEXT_FILE_LIMIT,
  MAX_EXTRACTED_CHARACTERS,
  MAX_SOURCE_CHUNKS,
} from "./constants";
import { SourceProcessingError } from "./errors";
import { normalizeSourceText } from "./normalize";

const PDF_MIME_TYPES = new Set(["", "application/pdf"]);
const TEXT_MIME_TYPES = new Set(["", "text/plain"]);
const MARKDOWN_MIME_TYPES = new Set(["", "text/plain", "text/markdown", "text/x-markdown"]);

export type SourceFiles = {
  slides: File;
  transcript: File;
  notes: File;
};

export type ProcessedSources = {
  chunks: SourceChunk[];
  totalCharacters: number;
  counts: Record<SourceType, number>;
};

export function assertExtractedTextLimit(values: string[]): number {
  const totalCharacters = values.reduce(
    (total, value) => total + normalizeSourceText(value).length,
    0,
  );
  if (totalCharacters > MAX_EXTRACTED_CHARACTERS) {
    throw new SourceProcessingError(
      "text_limit_exceeded",
      "slides",
      `The extracted source text exceeds the ${MAX_EXTRACTED_CHARACTERS.toLocaleString()} character limit.`,
    );
  }
  return totalCharacters;
}

function extension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot < 0 ? "" : fileName.slice(lastDot).toLowerCase();
}

function ensureSize(
  file: File,
  sourceType: SourceType,
  maximumBytes = FILE_LIMITS[sourceType],
  limitLabel = `${sourceType} limit`,
): void {
  if (file.size > maximumBytes) {
    const limit = maximumBytes === FILE_LIMITS.slides ? "10 MiB" : "1 MiB";
    throw new SourceProcessingError(
      "file_too_large",
      sourceType,
      `${file.name} is larger than the ${limit} ${limitLabel}.`,
    );
  }
}

export async function validatePdfFile(file: File): Promise<void> {
  ensureSize(file, "slides", FILE_LIMITS.slides, "lecture PDF limit");
  if (extension(file.name) !== ".pdf" || !PDF_MIME_TYPES.has(file.type.toLowerCase())) {
    throw new SourceProcessingError(
      "invalid_file_type",
      "slides",
      "The lecture source must be a PDF file in PDF mode.",
    );
  }
  const signature = new TextDecoder("ascii").decode(await file.slice(0, 5).arrayBuffer());
  if (signature !== "%PDF-") {
    throw new SourceProcessingError(
      "invalid_pdf",
      "slides",
      "The selected PDF does not have a valid PDF signature.",
    );
  }
}

async function decodeUtf8(
  file: File,
  sourceType: SourceType,
  maximumBytes = FILE_LIMITS[sourceType],
  limitLabel?: string,
): Promise<string> {
  ensureSize(file, sourceType, maximumBytes, limitLabel);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    if (text.includes("\u0000")) {
      throw new SourceProcessingError(
        "binary_text",
        sourceType,
        `${file.name} appears to contain binary content.`,
      );
    }
    return text;
  } catch (error: unknown) {
    if (error instanceof SourceProcessingError) throw error;
    throw new SourceProcessingError(
      "invalid_encoding",
      sourceType,
      `${file.name} must be valid UTF-8 text.`,
    );
  }
}

export async function readTranscriptFile(file: File): Promise<string> {
  if (extension(file.name) !== ".txt" || !TEXT_MIME_TYPES.has(file.type.toLowerCase())) {
    throw new SourceProcessingError(
      "invalid_file_type",
      "transcript",
      "The transcript must be a .txt file.",
    );
  }
  return decodeUtf8(file, "transcript");
}

export async function readLectureTextFile(file: File): Promise<string> {
  if (extension(file.name) !== ".txt" || !TEXT_MIME_TYPES.has(file.type.toLowerCase())) {
    throw new SourceProcessingError(
      "invalid_file_type",
      "slides",
      "The lecture source must be a PDF or UTF-8 .txt file.",
    );
  }
  return decodeUtf8(
    file,
    "slides",
    LECTURE_TEXT_FILE_LIMIT,
    "lecture text limit",
  );
}

export async function readNotesFile(file: File): Promise<string> {
  const fileExtension = extension(file.name);
  if (
    (fileExtension !== ".md" && fileExtension !== ".markdown") ||
    !MARKDOWN_MIME_TYPES.has(file.type.toLowerCase())
  ) {
    throw new SourceProcessingError(
      "invalid_file_type",
      "notes",
      "Existing notes must be a .md or .markdown file.",
    );
  }
  return decodeUtf8(file, "notes");
}

export function assertProcessedSources(chunks: SourceChunk[]): ProcessedSources {
  const counts: Record<SourceType, number> = { slides: 0, transcript: 0, notes: 0 };
  const characterCounts: Record<SourceType, number> = { slides: 0, transcript: 0, notes: 0 };
  for (const chunk of chunks) {
    counts[chunk.sourceType] += 1;
    characterCounts[chunk.sourceType] += normalizeSourceText(chunk.text).length;
  }

  for (const sourceType of ["slides", "transcript", "notes"] as const) {
    if (counts[sourceType] === 0 || characterCounts[sourceType] === 0) {
      throw new SourceProcessingError(
        "empty_source",
        sourceType,
        sourceType === "slides"
          ? "No usable text was found in the lecture source. Choose a text-based PDF or nonempty UTF-8 text."
          : `No usable text was found in the ${sourceType} file.`,
      );
    }
  }

  const totalCharacters = chunks.reduce((total, chunk) => total + chunk.text.length, 0);
  assertExtractedTextLimit(chunks.map((chunk) => chunk.text));
  if (chunks.length > MAX_SOURCE_CHUNKS) {
    throw new SourceProcessingError(
      "chunk_limit_exceeded",
      "slides",
      `The processed sources exceed the ${MAX_SOURCE_CHUNKS} chunk limit.`,
    );
  }
  return { chunks, totalCharacters, counts };
}
