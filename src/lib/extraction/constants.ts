export {
  MAX_CHUNK_CHARACTERS,
  MAX_EXTRACTED_CHARACTERS,
  MAX_SOURCE_CHUNKS,
} from "@/domain/limits";

export const LECTURE_TEXT_FILE_LIMIT = 1024 * 1024;

export const FILE_LIMITS = {
  slides: 10 * 1024 * 1024,
  transcript: LECTURE_TEXT_FILE_LIMIT,
  notes: LECTURE_TEXT_FILE_LIMIT,
} as const;

export const MAX_PDF_PAGES = 100;
