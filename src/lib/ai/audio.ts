import OpenAI from "openai";
import { z } from "zod";

import {
  AUDIO_TRANSCRIPTION_MODELS,
  AUDIO_TTS_MODELS,
  AudioFileExtensionSchema,
  AudioMimeTypeSchema,
  AudioTranscriptionModelSchema,
  AudioTranscriptionSuccessSchema,
  AudioTtsModelSchema,
  MAX_AUDIO_FILE_BYTES,
  MAX_AUDIO_TRANSCRIPT_CHARACTERS,
  MAX_AUDIO_TRANSCRIPT_SEGMENTS,
  formatAudioTranscriptText,
  normalizeAudioTranscriptSegmentText,
  normalizeAudioTranscriptSpeaker,
  type AudioErrorCode,
  type AudioFileExtension,
  type AudioMimeType,
  type AudioSpeechFormat,
  type AudioTranscriptionLanguage,
  type AudioTranscriptionModel,
  type AudioTranscriptionSuccess,
  type AudioTtsModel,
  type CredentialMode,
  type SpeechRequest,
} from "@/domain";

import { ProviderRequestError } from "./errors";
import {
  resolveSessionProviderKey,
  SessionProviderKeyError,
} from "./session-credential";

const AUDIO_PROVIDER_TIMEOUT_MS = 50_000;
const DEFAULT_TRANSCRIPTION_MODEL = AUDIO_TRANSCRIPTION_MODELS[0];
const DEFAULT_TTS_MODEL = AUDIO_TTS_MODELS[0];

type Environment = Readonly<Record<string, string | undefined>>;

type AudioFamily = "flac" | "mpeg" | "mp4" | "ogg" | "wav" | "webm";

const EXTENSION_FAMILIES: Readonly<Record<AudioFileExtension, AudioFamily>> = {
  ".flac": "flac",
  ".mp3": "mpeg",
  ".mp4": "mp4",
  ".mpeg": "mpeg",
  ".mpga": "mpeg",
  ".m4a": "mp4",
  ".ogg": "ogg",
  ".wav": "wav",
  ".webm": "webm",
};

const MIME_FAMILIES: Readonly<Record<AudioMimeType, AudioFamily>> = {
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/mpeg": "mpeg",
  "audio/mp3": "mpeg",
  "video/mpeg": "mpeg",
  "audio/mp4": "mp4",
  "video/mp4": "mp4",
  "audio/x-m4a": "mp4",
  "audio/ogg": "ogg",
  "application/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/webm": "webm",
  "video/webm": "webm",
};

const TranscriptionWireSchema = z
  .object({
    duration: z.number().finite().positive(),
    segments: z
      .array(
        z
          .object({
            start: z.number().finite().nonnegative(),
            end: z.number().finite().positive(),
            speaker: z.string().trim().min(1).max(80),
            text: z.string().trim().min(1).max(5_000),
          })
          .passthrough(),
      )
      .min(1)
      .max(MAX_AUDIO_TRANSCRIPT_SEGMENTS),
  })
  .passthrough();

export class AudioRequestError extends Error {
  readonly code: AudioErrorCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    code: AudioErrorCode,
    message: string,
    status: number,
    retryable = false,
  ) {
    super(message);
    this.name = "AudioRequestError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export type ValidatedAudioUpload = {
  file: File;
  fileName: string;
  extension: AudioFileExtension;
  mimeType: AudioMimeType;
};

export type AudioTranscriptionInvocation = {
  apiKey: string;
  model: AudioTranscriptionModel;
  file: File;
  language?: AudioTranscriptionLanguage;
  signal?: AbortSignal;
};

export type AudioTranscriptionInvoker = (
  input: AudioTranscriptionInvocation,
) => Promise<unknown>;

export type SpeechInvocation = {
  apiKey: string;
  model: AudioTtsModel;
  request: SpeechRequest;
  signal?: AbortSignal;
};

export type SpeechInvoker = (input: SpeechInvocation) => Promise<unknown>;

export type SpeechStream = {
  model: AudioTtsModel;
  response: Response;
};

function bytesMatch(
  bytes: Uint8Array,
  expected: readonly number[],
  offset = 0,
): boolean {
  return expected.every((value, index) => bytes[offset + index] === value);
}

function detectAudioFamily(bytes: Uint8Array): AudioFamily | null {
  if (bytesMatch(bytes, [0x66, 0x4c, 0x61, 0x43])) return "flac";
  if (bytesMatch(bytes, [0x4f, 0x67, 0x67, 0x53])) return "ogg";
  if (
    bytesMatch(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytesMatch(bytes, [0x57, 0x41, 0x56, 0x45], 8)
  ) {
    return "wav";
  }
  if (bytesMatch(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
  if (bytesMatch(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return "mp4";
  if (
    bytesMatch(bytes, [0x49, 0x44, 0x33]) ||
    (bytes[0] === 0xff && (bytes[1] ?? 0) >= 0xe0) ||
    (bytesMatch(bytes, [0x00, 0x00, 0x01]) &&
      [0xba, 0xb3, 0xb8].includes(bytes[3] ?? -1))
  ) {
    return "mpeg";
  }
  return null;
}

function sanitizedFileName(name: string): string {
  if (
    name.length === 0 ||
    name.length > 255 ||
    name !== name.trim() ||
    /[\\/\u0000-\u001f\u007f]/u.test(name)
  ) {
    throw new AudioRequestError(
      "invalid_request",
      "The audio file name is invalid.",
      400,
    );
  }
  return name;
}

function fileExtension(fileName: string): AudioFileExtension {
  const dotIndex = fileName.lastIndexOf(".");
  const extension = dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : "";
  const parsed = AudioFileExtensionSchema.safeParse(extension);
  if (!parsed.success) {
    throw new AudioRequestError(
      "invalid_request",
      "Use a supported FLAC, MP3, MP4, MPEG, MPGA, M4A, OGG, WAV, or WebM audio file.",
      415,
    );
  }
  return parsed.data;
}

function fileMimeType(type: string): AudioMimeType {
  const normalized = type.trim().toLowerCase();
  const parsed = AudioMimeTypeSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new AudioRequestError(
      "invalid_request",
      "The audio file has an unsupported media type.",
      415,
    );
  }
  return parsed.data;
}

export async function validateAudioUpload(
  file: File,
): Promise<ValidatedAudioUpload> {
  if (file.size === 0) {
    throw new AudioRequestError(
      "invalid_request",
      "The audio file is empty.",
      400,
    );
  }
  if (file.size > MAX_AUDIO_FILE_BYTES) {
    throw new AudioRequestError(
      "request_too_large",
      "The audio file exceeds LectureWeaver's 4 MB upload limit.",
      413,
    );
  }

  const fileName = sanitizedFileName(file.name);
  const extension = fileExtension(fileName);
  const mimeType = fileMimeType(file.type);
  const signature = detectAudioFamily(
    new Uint8Array(await file.slice(0, 16).arrayBuffer()),
  );
  const expectedFamily = EXTENSION_FAMILIES[extension];

  if (
    signature === null ||
    signature !== expectedFamily ||
    MIME_FAMILIES[mimeType] !== expectedFamily
  ) {
    throw new AudioRequestError(
      "invalid_request",
      "The audio extension, media type, and file signature do not agree.",
      415,
    );
  }

  return { file, fileName, extension, mimeType };
}

function requireApiKey(
  environment: Environment,
  credentialMode: CredentialMode,
  sessionApiKey?: string,
): string {
  let resolvedSessionKey: string | undefined;
  try {
    resolvedSessionKey = resolveSessionProviderKey(
      credentialMode,
      sessionApiKey,
    );
  } catch (error: unknown) {
    if (error instanceof SessionProviderKeyError) {
      throw new AudioRequestError(
        "invalid_request",
        "The selected credential mode does not match the supplied credential.",
        400,
      );
    }
    throw error;
  }

  if (credentialMode === "session") {
    if (resolvedSessionKey === undefined) {
      throw new AudioRequestError(
        "invalid_request",
        "The selected credential mode does not match the supplied credential.",
        400,
      );
    }
    return resolvedSessionKey;
  }

  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    throw new AudioRequestError(
      "provider_not_configured",
      "OpenAI audio is not configured on this deployment.",
      503,
    );
  }
  return apiKey;
}

function transcriptionModel(environment: Environment): AudioTranscriptionModel {
  const configured = environment.OPENAI_TRANSCRIBE_MODEL?.trim();
  const parsed = AudioTranscriptionModelSchema.safeParse(
    configured === undefined || configured.length === 0
      ? DEFAULT_TRANSCRIPTION_MODEL
      : configured,
  );
  if (!parsed.success) {
    throw new AudioRequestError(
      "unsupported_model",
      "The configured OpenAI transcription model is not allowlisted.",
      503,
    );
  }
  return parsed.data;
}

function ttsModel(environment: Environment): AudioTtsModel {
  const configured = environment.OPENAI_TTS_MODEL?.trim();
  const parsed = AudioTtsModelSchema.safeParse(
    configured === undefined || configured.length === 0
      ? DEFAULT_TTS_MODEL
      : configured,
  );
  if (!parsed.success) {
    throw new AudioRequestError(
      "unsupported_model",
      "The configured OpenAI text-to-speech model is not allowlisted.",
      503,
    );
  }
  return parsed.data;
}

function audioProviderHttpError(
  status: number,
  identifiers: readonly string[],
): ProviderRequestError {
  const normalized = new Set(
    identifiers.map((identifier) => identifier.trim().toLowerCase()),
  );
  if (
    normalized.has("exceeded_current_quota_error") ||
    normalized.has("insufficient_quota") ||
    normalized.has("billing_hard_limit_reached")
  ) {
    return new ProviderRequestError(
      "provider_balance",
      "OpenAI reports insufficient API balance for audio generation.",
      503,
      false,
    );
  }
  if (status === 401 || status === 403) {
    return new ProviderRequestError(
      "provider_auth",
      "OpenAI rejected the supplied API credentials.",
      503,
      false,
    );
  }
  if (status === 429) {
    return new ProviderRequestError(
      "rate_limited",
      "OpenAI is rate-limiting audio requests. Please retry later.",
      429,
      true,
    );
  }
  return new ProviderRequestError(
    "provider_error",
    "OpenAI could not complete the audio request.",
    502,
    status >= 500,
  );
}

function mapOpenAIAudioError(error: unknown): never {
  if (error instanceof AudioRequestError || error instanceof ProviderRequestError) {
    throw error;
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    throw new ProviderRequestError(
      "provider_timeout",
      "OpenAI did not finish within the audio request time limit.",
      504,
      true,
    );
  }
  if (error instanceof OpenAI.APIConnectionError) {
    throw new ProviderRequestError(
      "provider_error",
      "OpenAI audio could not be reached.",
      502,
      true,
    );
  }
  if (error instanceof OpenAI.APIError && error.status !== undefined) {
    throw audioProviderHttpError(error.status, [
      error.code ?? "",
      error.type ?? "",
    ]);
  }
  throw new ProviderRequestError(
    "provider_error",
    "OpenAI could not complete the audio request.",
    502,
    true,
  );
}

export const invokeOpenAITranscription: AudioTranscriptionInvoker = async ({
  apiKey,
  model,
  file,
  language,
  signal,
}) => {
  const client = new OpenAI({
    apiKey,
    fetch: globalThis.fetch,
    maxRetries: 0,
    timeout: AUDIO_PROVIDER_TIMEOUT_MS,
  });
  return client.audio.transcriptions.create(
    {
      file,
      model,
      response_format: "diarized_json",
      chunking_strategy: "auto",
      ...(language === undefined ? {} : { language }),
    },
    signal === undefined ? undefined : { signal },
  );
};

export async function transcribeAudioWithOpenAI(
  upload: ValidatedAudioUpload,
  language: AudioTranscriptionLanguage | undefined,
  environment: Environment = process.env,
  invoke: AudioTranscriptionInvoker = invokeOpenAITranscription,
  signal: AbortSignal | undefined,
  credentialMode: CredentialMode,
  sessionApiKey?: string,
): Promise<AudioTranscriptionSuccess> {
  const apiKey = requireApiKey(environment, credentialMode, sessionApiKey);
  const model = transcriptionModel(environment);

  let raw: unknown;
  try {
    raw = await invoke({
      apiKey,
      model,
      file: upload.file,
      language,
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error: unknown) {
    mapOpenAIAudioError(error);
  }

  const wire = TranscriptionWireSchema.safeParse(raw);
  if (!wire.success) {
    throw new ProviderRequestError(
      "provider_invalid_output",
      "OpenAI returned an invalid timestamped transcript.",
      502,
      true,
    );
  }

  const segments = wire.data.segments.map((segment) => ({
    startSeconds: segment.start,
    endSeconds: segment.end,
    speaker: normalizeAudioTranscriptSpeaker(segment.speaker),
    text: normalizeAudioTranscriptSegmentText(segment.text),
  }));
  const text = formatAudioTranscriptText(segments);
  if (text.length > MAX_AUDIO_TRANSCRIPT_CHARACTERS) {
    throw new ProviderRequestError(
      "provider_invalid_output",
      "OpenAI returned a transcript that exceeds LectureWeaver's limits.",
      502,
      false,
    );
  }

  const result = AudioTranscriptionSuccessSchema.safeParse({
    model,
    fileName: upload.fileName,
    text,
    durationSeconds: wire.data.duration,
    segments,
  });
  if (!result.success) {
    throw new ProviderRequestError(
      "provider_invalid_output",
      "OpenAI returned an invalid timestamped transcript.",
      502,
      true,
    );
  }
  return result.data;
}

export const invokeOpenAISpeech: SpeechInvoker = async ({
  apiKey,
  model,
  request,
  signal,
}) => {
  const client = new OpenAI({
    apiKey,
    fetch: globalThis.fetch,
    maxRetries: 0,
    timeout: AUDIO_PROVIDER_TIMEOUT_MS,
  });
  return client.audio.speech.create(
    {
      model,
      input: request.text,
      voice: request.voice,
      response_format: request.format,
      stream_format: "audio",
      instructions:
        "Speak clearly and naturally as an engaging study guide. Preserve the meaning and language of the supplied notes.",
    },
    signal === undefined ? undefined : { signal },
  );
};

function invalidSpeechStream(): ProviderRequestError {
  return new ProviderRequestError(
    "provider_invalid_output",
    "OpenAI returned an invalid audio stream.",
    502,
    true,
  );
}

function hasValidSpeechPrefix(
  prefix: Uint8Array,
  format: AudioSpeechFormat,
): boolean {
  if (format === "wav") {
    return (
      prefix.byteLength >= 12 &&
      bytesMatch(prefix, [0x52, 0x49, 0x46, 0x46]) &&
      bytesMatch(prefix, [0x57, 0x41, 0x56, 0x45], 8)
    );
  }
  return (
    bytesMatch(prefix, [0x49, 0x44, 0x33]) ||
    (prefix.byteLength >= 2 &&
      prefix[0] === 0xff &&
      ((prefix[1] ?? 0) & 0xe0) === 0xe0)
  );
}

async function validatedSpeechBody(
  body: ReadableStream<Uint8Array>,
  format: AudioSpeechFormat,
): Promise<ReadableStream<Uint8Array>> {
  const requiredPrefixBytes = format === "wav" ? 12 : 3;
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (totalBytes < requiredPrefixBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      totalBytes += value.byteLength;
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
    throw invalidSpeechStream();
  }

  const prefix = new Uint8Array(
    Math.min(totalBytes, requiredPrefixBytes),
  );
  let prefixOffset = 0;
  for (const chunk of chunks) {
    if (prefixOffset >= prefix.byteLength) break;
    const remaining = prefix.byteLength - prefixOffset;
    const slice = chunk.subarray(0, remaining);
    prefix.set(slice, prefixOffset);
    prefixOffset += slice.byteLength;
  }

  if (!hasValidSpeechPrefix(prefix, format)) {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
    throw invalidSpeechStream();
  }

  let released = false;
  const release = (): void => {
    if (released) return;
    released = true;
    reader.releaseLock();
  };

  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          release();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error: unknown) {
        release();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        release();
      }
    },
  });
}

export async function createSpeechWithOpenAI(
  request: SpeechRequest,
  environment: Environment = process.env,
  invoke: SpeechInvoker = invokeOpenAISpeech,
  signal: AbortSignal | undefined,
  credentialMode: CredentialMode,
  sessionApiKey?: string,
): Promise<SpeechStream> {
  const apiKey = requireApiKey(environment, credentialMode, sessionApiKey);
  const model = ttsModel(environment);

  let raw: unknown;
  try {
    raw = await invoke({
      apiKey,
      model,
      request,
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error: unknown) {
    mapOpenAIAudioError(error);
  }

  if (!(raw instanceof Response) || raw.body === null || !raw.ok) {
    throw invalidSpeechStream();
  }
  const body = await validatedSpeechBody(raw.body, request.format);
  return { model, response: new Response(body, { status: 200 }) };
}
