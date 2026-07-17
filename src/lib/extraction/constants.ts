export const FILE_LIMITS = {
  slides: 10 * 1024 * 1024,
  transcript: 1024 * 1024,
  notes: 1024 * 1024,
} as const;

export const MAX_PDF_PAGES = 100;
export const MAX_EXTRACTED_CHARACTERS = 120_000;
export const MAX_SOURCE_CHUNKS = 100;
export const MAX_CHUNK_CHARACTERS = 1_800;
