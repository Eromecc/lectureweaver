import { z } from "zod";

import { CredentialModeSchema } from "./api";

import {
  MAX_AUDIO_TRANSCRIPT_CHARACTERS,
  MAX_AUDIO_TRANSCRIPT_SEGMENTS,
  MAX_SPEECH_INPUT_CHARACTERS,
} from "./limits";

const nonEmptyText = z.string().trim().min(1);

export const AUDIO_FILE_EXTENSIONS = [
  ".flac",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".m4a",
  ".ogg",
  ".wav",
  ".webm",
] as const;

export const AUDIO_MIME_TYPES = [
  "audio/flac",
  "audio/x-flac",
  "audio/mpeg",
  "audio/mp3",
  "video/mpeg",
  "audio/mp4",
  "video/mp4",
  "audio/x-m4a",
  "audio/ogg",
  "application/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/webm",
  "video/webm",
] as const;

export const AUDIO_TRANSCRIPTION_MODELS = [
  "gpt-4o-transcribe-diarize",
] as const;

export const AUDIO_TTS_MODELS = ["gpt-4o-mini-tts"] as const;

export const AUDIO_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar",
] as const;

export const AUDIO_SPEECH_FORMATS = ["mp3", "wav"] as const;

export const AudioFileExtensionSchema = z.enum(AUDIO_FILE_EXTENSIONS);
export const AudioMimeTypeSchema = z.enum(AUDIO_MIME_TYPES);
export const AudioTranscriptionModelSchema = z.enum(
  AUDIO_TRANSCRIPTION_MODELS,
);
export const AudioTtsModelSchema = z.enum(AUDIO_TTS_MODELS);
export const AudioVoiceSchema = z.enum(AUDIO_VOICES);
export const AudioSpeechFormatSchema = z.enum(AUDIO_SPEECH_FORMATS);
export const AudioTranscriptionLanguageSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z]{2}$/, "Language must be a two-letter ISO-639-1 code.");

export function normalizeAudioTranscriptSegmentText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

export function normalizeAudioTranscriptSpeaker(speaker: string): string {
  const normalized = normalizeAudioTranscriptSegmentText(speaker);
  return /^[a-z]$/iu.test(normalized)
    ? `Speaker ${normalized.toUpperCase()}`
    : normalized;
}

export function formatAudioTranscriptText(
  segments: readonly Readonly<{ speaker: string; text: string }>[],
): string {
  return segments
    .map(
      (segment) =>
        `${normalizeAudioTranscriptSpeaker(segment.speaker)}: ${normalizeAudioTranscriptSegmentText(segment.text)}`,
    )
    .join("\n\n");
}

export const AudioTranscriptionFileNameSchema = z
  .string()
  .min(1)
  .max(255)
  .superRefine((fileName, context) => {
    if (
      fileName !== fileName.trim() ||
      /[\\/\u0000-\u001f\u007f]/u.test(fileName)
    ) {
      context.addIssue({
        code: "custom",
        message: "Audio file names cannot contain paths or control characters.",
      });
    }
    const lowerName = fileName.toLowerCase();
    if (!AUDIO_FILE_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
      context.addIssue({
        code: "custom",
        message: "The audio file name must use an allowlisted extension.",
      });
    }
  });

export const AudioTranscriptionSegmentSchema = z
  .object({
    startSeconds: z.number().finite().nonnegative(),
    endSeconds: z.number().finite().positive(),
    speaker: z.string().min(1).max(80),
    text: z.string().min(1).max(5_000),
  })
  .strict()
  .superRefine((segment, context) => {
    if (segment.endSeconds <= segment.startSeconds) {
      context.addIssue({
        code: "custom",
        message: "A transcript segment must end after it starts.",
        path: ["endSeconds"],
      });
    }
    if (segment.speaker !== normalizeAudioTranscriptSpeaker(segment.speaker)) {
      context.addIssue({
        code: "custom",
        message: "Transcript speaker labels must use normalized display labels.",
        path: ["speaker"],
      });
    }
    if (segment.text !== normalizeAudioTranscriptSegmentText(segment.text)) {
      context.addIssue({
        code: "custom",
        message: "Transcript segment text must be normalized.",
        path: ["text"],
      });
    }
  });

export const AudioTranscriptionSuccessSchema = z
  .object({
    model: AudioTranscriptionModelSchema,
    fileName: AudioTranscriptionFileNameSchema,
    text: z.string().min(1).max(MAX_AUDIO_TRANSCRIPT_CHARACTERS),
    durationSeconds: z.number().finite().positive(),
    segments: z
      .array(AudioTranscriptionSegmentSchema)
      .min(1)
      .max(MAX_AUDIO_TRANSCRIPT_SEGMENTS),
  })
  .strict()
  .superRefine((transcription, context) => {
    if (transcription.text !== formatAudioTranscriptText(transcription.segments)) {
      context.addIssue({
        code: "custom",
        message: "Transcript text must be derived exactly from its segments.",
        path: ["text"],
      });
    }
    let previousEnd = 0;
    transcription.segments.forEach((segment, index) => {
      if (index > 0 && segment.startSeconds < previousEnd) {
        context.addIssue({
          code: "custom",
          message: "Transcript segments must be ordered and non-overlapping.",
          path: ["segments", index, "startSeconds"],
        });
      }
      if (segment.endSeconds > transcription.durationSeconds + 0.01) {
        context.addIssue({
          code: "custom",
          message: "Transcript segments cannot exceed the audio duration.",
          path: ["segments", index, "endSeconds"],
        });
      }
      previousEnd = segment.endSeconds;
    });
  });

export const SpeechRequestSchema = z
  .object({
    text: nonEmptyText.max(MAX_SPEECH_INPUT_CHARACTERS),
    voice: AudioVoiceSchema,
    format: AudioSpeechFormatSchema,
  })
  .strict();

export const SpeechApiRequestSchema = SpeechRequestSchema.extend({
  credentialMode: CredentialModeSchema,
}).strict();

export const AudioErrorCodeSchema = z.enum([
  "invalid_request",
  "request_too_large",
  "provider_not_configured",
  "unsupported_model",
  "provider_auth",
  "provider_balance",
  "rate_limited",
  "provider_timeout",
  "provider_refusal",
  "provider_invalid_output",
  "provider_error",
  "internal_error",
]);

export const AudioErrorSchema = z
  .object({
    error: z
      .object({
        code: AudioErrorCodeSchema,
        message: nonEmptyText.max(500),
        retryable: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type AudioFileExtension = z.infer<typeof AudioFileExtensionSchema>;
export type AudioMimeType = z.infer<typeof AudioMimeTypeSchema>;
export type AudioTranscriptionModel = z.infer<
  typeof AudioTranscriptionModelSchema
>;
export type AudioTtsModel = z.infer<typeof AudioTtsModelSchema>;
export type AudioVoice = z.infer<typeof AudioVoiceSchema>;
export type AudioSpeechFormat = z.infer<typeof AudioSpeechFormatSchema>;
export type AudioTranscriptionLanguage = z.infer<
  typeof AudioTranscriptionLanguageSchema
>;
export type AudioTranscriptionSegment = z.infer<
  typeof AudioTranscriptionSegmentSchema
>;
export type AudioTranscriptionSuccess = z.infer<
  typeof AudioTranscriptionSuccessSchema
>;
export type SpeechRequest = z.infer<typeof SpeechRequestSchema>;
export type SpeechApiRequest = z.infer<typeof SpeechApiRequestSchema>;
export type AudioErrorCode = z.infer<typeof AudioErrorCodeSchema>;
export type AudioError = z.infer<typeof AudioErrorSchema>;
