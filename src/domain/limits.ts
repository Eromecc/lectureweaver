export const MAX_EXTRACTED_CHARACTERS = 120_000;
export const MAX_SOURCE_CHUNKS = 100;
export const MAX_CHUNK_CHARACTERS = 1_800;
export const MAX_ENHANCED_NOTE_SECTIONS = 16;
export const MAX_ENHANCED_NOTE_SECTION_CHARACTERS = 5_000;
export const MAX_ENHANCED_NOTES_CHARACTERS = 40_000;
export const MAX_ANKI_CARDS = 40;
export const MAX_ANKI_FRONT_CHARACTERS = 500;
export const MAX_ANKI_BACK_CHARACTERS = 1_800;

// Keep the audio file below Vercel's 4.5 MB Function request-body limit and
// reserve room for multipart boundaries and headers.
export const MAX_AUDIO_FILE_BYTES = 4_000_000;
export const MAX_AUDIO_MULTIPART_BODY_BYTES = 4_250_000;
export const MAX_AUDIO_TRANSCRIPT_CHARACTERS = 120_000;
export const MAX_AUDIO_TRANSCRIPT_SEGMENTS = 2_000;
export const MAX_SPEECH_INPUT_CHARACTERS = 4_096;
