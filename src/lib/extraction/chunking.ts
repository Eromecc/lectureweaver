import type { SourceChunk, SourceType } from "@/domain";
import { MAX_CHUNK_CHARACTERS } from "./constants";
import { parseMarkdownBlocks } from "./markdown";
import { normalizeChunkText, normalizeSourceText } from "./normalize";

export type PdfPageText = {
  pageNumber: number;
  text: string;
};

type ParagraphUnit = {
  ordinal: number;
  text: string;
  headingPath?: string[];
};

function pad(value: number, width: number): string {
  return value.toString().padStart(width, "0");
}
function adjustForSurrogatePair(text: string, index: number): number {
  if (index <= 0 || index >= text.length) return index;
  const previous = text.charCodeAt(index - 1);
  const current = text.charCodeAt(index);
  if (previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff) {
    return index - 1;
  }
  return index;
}

function findBreakIndex(text: string, maxLength: number): number {
  const window = text.slice(0, maxLength + 1);
  const minimumUsefulBreak = Math.floor(maxLength * 0.55);
  const candidates = [
    window.lastIndexOf("\n"),
    Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "), window.lastIndexOf("! ")),
    window.lastIndexOf(" "),
  ];
  const candidate = candidates.find((value) => value >= minimumUsefulBreak);
  return adjustForSurrogatePair(text, candidate === undefined ? maxLength : candidate + 1);
}

export function splitOversizedText(
  value: string,
  maxLength = MAX_CHUNK_CHARACTERS,
): string[] {
  const pieces: string[] = [];
  let remaining = value.trim();
  while (remaining.length > maxLength) {
    const breakIndex = findBreakIndex(remaining, maxLength);
    const piece = remaining.slice(0, breakIndex).trim();
    if (piece) pieces.push(piece);
    remaining = remaining.slice(breakIndex).trim();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}

export function chunkPdfPages(
  pages: PdfPageText[],
  sourceName: string,
  maxLength = MAX_CHUNK_CHARACTERS,
): SourceChunk[] {
  return pages.flatMap((page) => {
    const text = normalizeChunkText(page.text);
    if (!text) return [];
    return splitOversizedText(text, maxLength).map((piece, index) => ({
      id: `slides:p${pad(page.pageNumber, 4)}:c${pad(index + 1, 2)}`,
      sourceType: "slides" as const,
      sourceName,
      locator: `Page ${page.pageNumber}`,
      text: piece,
    }));
  });
}

function sameHeadingPath(left?: string[], right?: string[]): boolean {
  if (left === undefined && right === undefined) return true;
  if (left === undefined || right === undefined || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function createParagraphChunk(
  sourceType: Extract<SourceType, "transcript" | "notes">,
  sourceName: string,
  units: ParagraphUnit[],
  text: string,
  part: number,
): SourceChunk {
  const first = units[0]?.ordinal ?? 1;
  const last = units.at(-1)?.ordinal ?? first;
  const range = first === last ? `p${pad(first, 4)}` : `p${pad(first, 4)}-p${pad(last, 4)}`;
  const noun = first === last ? "Paragraph" : "Paragraphs";
  const locator = first === last ? `${noun} ${first}` : `${noun} ${first}-${last}`;
  const headingPath = units[0]?.headingPath;
  return {
    id: `${sourceType}:${range}:c${pad(part, 2)}`,
    sourceType,
    sourceName,
    locator,
    ...(headingPath && headingPath.length > 0 ? { headingPath: [...headingPath] } : {}),
    text: normalizeChunkText(text),
  };
}

function chunkParagraphUnits(
  sourceType: Extract<SourceType, "transcript" | "notes">,
  sourceName: string,
  units: ParagraphUnit[],
  maxLength: number,
): SourceChunk[] {
  const chunks: SourceChunk[] = [];
  let pending: ParagraphUnit[] = [];
  let pendingText = "";

  const flush = () => {
    if (pending.length === 0 || !pendingText) return;
    chunks.push(createParagraphChunk(sourceType, sourceName, pending, pendingText, 1));
    pending = [];
    pendingText = "";
  };

  for (const unit of units) {
    const text = normalizeChunkText(unit.text);
    if (!text) continue;

    if (text.length > maxLength) {
      flush();
      const pieces = splitOversizedText(text, maxLength);
      pieces.forEach((piece, index) => {
        chunks.push(createParagraphChunk(sourceType, sourceName, [unit], piece, index + 1));
      });
      continue;
    }

    const headingChanged =
      pending.length > 0 && !sameHeadingPath(pending[0]?.headingPath, unit.headingPath);
    const candidate = pendingText ? `${pendingText}\n\n${text}` : text;
    if (headingChanged || candidate.length > maxLength) flush();

    pending.push(unit);
    pendingText = pendingText ? `${pendingText}\n\n${text}` : text;
  }

  flush();
  return chunks;
}

export function chunkTranscript(
  transcript: string,
  sourceName: string,
  maxLength = MAX_CHUNK_CHARACTERS,
): SourceChunk[] {
  const normalized = normalizeSourceText(transcript);
  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({ ordinal: index + 1, text }));
  return chunkParagraphUnits("transcript", sourceName, paragraphs, maxLength);
}

export function chunkMarkdownNotes(
  markdown: string,
  sourceName: string,
  maxLength = MAX_CHUNK_CHARACTERS,
): SourceChunk[] {
  return chunkParagraphUnits("notes", sourceName, parseMarkdownBlocks(markdown), maxLength);
}
