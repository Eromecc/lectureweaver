import {
  AUDIO_FILE_EXTENSIONS,
  AUDIO_MIME_TYPES,
  AudioErrorSchema,
  AudioTranscriptionSuccessSchema,
  MAX_AUDIO_FILE_BYTES,
  SpeechRequestSchema,
  type AudioErrorCode,
  type AudioFileExtension,
  type AudioMimeType,
  type AudioTranscriptionSuccess,
  type SpeechRequest,
} from "@/domain";

import {
  SessionProviderKeyError,
  sessionProviderKeyHeaders,
} from "./session-credential";

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

export class AudioClientError extends Error {
  readonly code: AudioErrorCode | "invalid_file" | "unreadable_response";
  readonly retryable: boolean;

  constructor(
    code: AudioClientError["code"],
    message: string,
    retryable: boolean,
  ) {
    super(message);
    this.name = "AudioClientError";
    this.code = code;
    this.retryable = retryable;
  }
}

export type AudioClientRequestOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  sessionApiKey?: string;
};

type AudioClientRequestInput = typeof fetch | AudioClientRequestOptions;

function resolveRequestOptions(
  input: AudioClientRequestInput | undefined,
): Required<Pick<AudioClientRequestOptions, "fetchImpl">> &
  Pick<AudioClientRequestOptions, "signal" | "sessionApiKey"> {
  return typeof input === "function"
    ? { fetchImpl: input }
    : {
        fetchImpl: input?.fetchImpl ?? fetch,
        signal: input?.signal,
        sessionApiKey: input?.sessionApiKey,
      };
}

function fileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

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

export async function validateAudioFile(file: File): Promise<void> {
  const extension = fileExtension(file.name);
  const parsedExtension = AUDIO_FILE_EXTENSIONS.find(
    (candidate) => candidate === extension,
  );
  if (parsedExtension === undefined) {
    throw new AudioClientError(
      "invalid_file",
      `Choose a supported audio file (${AUDIO_FILE_EXTENSIONS.join(", ")}).`,
      false,
    );
  }

  const mimeType = file.type.trim().toLowerCase();
  const parsedMimeType = AUDIO_MIME_TYPES.find(
    (candidate) => candidate === mimeType,
  );
  if (parsedMimeType === undefined) {
    throw new AudioClientError(
      "invalid_file",
      `${file.name} has an unsupported audio content type.`,
      false,
    );
  }

  if (file.size === 0) {
    throw new AudioClientError(
      "invalid_file",
      `${file.name} is empty. Choose a recording that contains audio.`,
      false,
    );
  }

  if (file.size > MAX_AUDIO_FILE_BYTES) {
    throw new AudioClientError(
      "invalid_file",
      `${file.name} is larger than the ${formatMegabytes(MAX_AUDIO_FILE_BYTES)} audio upload limit.`,
      false,
    );
  }

  const detectedFamily = detectAudioFamily(
    new Uint8Array(await file.slice(0, 16).arrayBuffer()),
  );
  const expectedFamily = EXTENSION_FAMILIES[parsedExtension];
  if (
    detectedFamily === null ||
    detectedFamily !== expectedFamily ||
    MIME_FAMILIES[parsedMimeType] !== expectedFamily
  ) {
    throw new AudioClientError(
      "invalid_file",
      "The audio extension, content type, and file signature do not agree.",
      false,
    );
  }
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(0)} MB`;
}

async function parseAudioError(response: Response): Promise<AudioClientError> {
  let payload: unknown;
  try {
    payload = JSON.parse(await response.text()) as unknown;
  } catch {
    return new AudioClientError(
      "unreadable_response",
      "The audio service returned an unreadable response.",
      response.status >= 500 || response.status === 429,
    );
  }

  const parsed = AudioErrorSchema.safeParse(payload);
  if (parsed.success) {
    return new AudioClientError(
      parsed.data.error.code,
      parsed.data.error.message,
      parsed.data.error.retryable,
    );
  }

  return new AudioClientError(
    "unreadable_response",
    "The audio service could not complete the request.",
    response.status >= 500 || response.status === 429,
  );
}

export async function requestAudioTranscription(
  file: File,
  input?: AudioClientRequestInput,
): Promise<AudioTranscriptionSuccess> {
  const { fetchImpl, signal, sessionApiKey } = resolveRequestOptions(input);
  await validateAudioFile(file);
  if (signal?.aborted) {
    throw new AudioClientError(
      "provider_error",
      "The transcription request was cancelled.",
      true,
    );
  }
  const formData = new FormData();
  formData.set("audio", file, file.name);

  let response: Response;
  try {
    const credentialHeaders = sessionProviderKeyHeaders(sessionApiKey);
    const credentialMode =
      Object.keys(credentialHeaders).length === 0 ? "deployment" : "session";
    formData.set("credentialMode", credentialMode);
    response = await fetchImpl("/api/transcribe", {
      method: "POST",
      ...(Object.keys(credentialHeaders).length === 0
        ? {}
        : { headers: credentialHeaders }),
      body: formData,
      cache: "no-store",
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error: unknown) {
    if (error instanceof SessionProviderKeyError) {
      throw new AudioClientError(
        "invalid_request",
        "Enter a valid temporary OpenAI credential.",
        false,
      );
    }
    throw new AudioClientError(
      "provider_error",
      "The transcription service could not be reached.",
      true,
    );
  }

  if (!response.ok) throw await parseAudioError(response);

  let payload: unknown;
  try {
    payload = JSON.parse(await response.text()) as unknown;
  } catch {
    throw new AudioClientError(
      "unreadable_response",
      "The transcription service returned an unreadable response.",
      true,
    );
  }

  const parsed = AudioTranscriptionSuccessSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AudioClientError(
      "provider_invalid_output",
      "The transcription service returned timestamped text that failed validation.",
      true,
    );
  }
  return parsed.data;
}

export type GeneratedSpeech = {
  blob: Blob;
  fileName: string;
};

export async function requestStudyGuideSpeech(
  input: SpeechRequest,
  requestInput?: AudioClientRequestInput,
): Promise<GeneratedSpeech> {
  const request = SpeechRequestSchema.safeParse(input);
  if (!request.success) {
    throw new AudioClientError(
      "invalid_request",
      "Choose a valid voice, format, and narration section within the speech limit.",
      false,
    );
  }
  const { fetchImpl, signal, sessionApiKey } = resolveRequestOptions(requestInput);
  if (signal?.aborted) {
    throw new AudioClientError(
      "provider_error",
      "The speech request was cancelled.",
      true,
    );
  }

  let response: Response;
  try {
    const credentialHeaders = sessionProviderKeyHeaders(sessionApiKey);
    const credentialMode =
      Object.keys(credentialHeaders).length === 0 ? "deployment" : "session";
    response = await fetchImpl("/api/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...credentialHeaders,
      },
      body: JSON.stringify({ ...request.data, credentialMode }),
      cache: "no-store",
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error: unknown) {
    if (error instanceof SessionProviderKeyError) {
      throw new AudioClientError(
        "invalid_request",
        "Enter a valid temporary OpenAI credential.",
        false,
      );
    }
    throw new AudioClientError(
      "provider_error",
      "The speech service could not be reached.",
      true,
    );
  }

  if (!response.ok) throw await parseAudioError(response);

  const expectedType = request.data.format === "mp3" ? "audio/mpeg" : "audio/wav";
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim();
  if (contentType !== expectedType) {
    throw new AudioClientError(
      "provider_invalid_output",
      "The speech service returned an unexpected audio format.",
      true,
    );
  }

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    throw new AudioClientError(
      "provider_error",
      "The generated audio stream could not be read. Please retry.",
      true,
    );
  }
  if (blob.size === 0) {
    throw new AudioClientError(
      "provider_invalid_output",
      "The speech service returned an empty audio file.",
      true,
    );
  }

  return {
    blob,
    fileName: `lectureweaver-study-guide.${request.data.format}`,
  };
}
