export {
  MAX_CHUNK_CHARACTERS,
  MAX_EXTRACTED_CHARACTERS,
  MAX_SOURCE_CHUNKS,
} from "@/domain/limits";

export const FILE_LIMITS = {
  slides: 10 * 1024 * 1024,
  transcript: 1024 * 1024,
  notes: 1024 * 1024,
} as const;

export const MAX_PDF_PAGES = 100;
