import {
  AudioTranscriptionLanguageSchema,
  MAX_AUDIO_MULTIPART_BODY_BYTES,
} from "@/domain";
import {
  transcribeAudioWithOpenAI,
  validateAudioUpload,
} from "@/lib/ai/audio";
import {
  audioErrorResponse,
  audioFailureResponse,
} from "@/lib/ai/audio-http";

export const runtime = "nodejs";
export const maxDuration = 60;

class MultipartBodyTooLargeError extends Error {}

async function readBoundedBody(
  request: Request,
): Promise<Uint8Array<ArrayBuffer>> {
  if (request.body === null) return new Uint8Array();

  const reader = request.body.getReader();
  const parts: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_AUDIO_MULTIPART_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new MultipartBodyTooLargeError();
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const part of parts) {
    body.set(part, offset);
    offset += part.byteLength;
  }
  return body;
}

async function parseBoundedFormData(
  request: Request,
  contentType: string,
): Promise<FormData> {
  const bytes = await readBoundedBody(request);
  return new Response(bytes.buffer, {
    headers: { "Content-Type": contentType },
  }).formData();
}

function isFileEntry(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.name === "string" &&
    typeof value.type === "string" &&
    typeof value.size === "number" &&
    typeof value.slice === "function" &&
    typeof value.arrayBuffer === "function"
  );
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if (mediaType !== "multipart/form-data") {
    return audioErrorResponse(
      "invalid_request",
      "Transcription requests must use multipart/form-data.",
      false,
      415,
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_AUDIO_MULTIPART_BODY_BYTES
  ) {
    return audioErrorResponse(
      "request_too_large",
      "The audio upload request is too large.",
      false,
      413,
    );
  }

  let formData: FormData;
  try {
    formData = await parseBoundedFormData(request, contentType);
  } catch (error: unknown) {
    if (error instanceof MultipartBodyTooLargeError) {
      return audioErrorResponse(
        "request_too_large",
        "The audio upload request is too large.",
        false,
        413,
      );
    }
    return audioErrorResponse(
      "invalid_request",
      "The audio upload could not be read as multipart form data.",
      false,
      400,
    );
  }

  const keys = new Set(formData.keys());
  if ([...keys].some((key) => key !== "audio" && key !== "language")) {
    return audioErrorResponse(
      "invalid_request",
      "The transcription request contains unsupported fields.",
      false,
      400,
    );
  }

  const audioValues = formData.getAll("audio");
  const audioFile = audioValues[0];
  if (audioValues.length !== 1 || audioFile === undefined || !isFileEntry(audioFile)) {
    return audioErrorResponse(
      "invalid_request",
      "Attach exactly one audio file in the audio field.",
      false,
      400,
    );
  }

  const languageValues = formData.getAll("language");
  if (
    languageValues.length > 1 ||
    (languageValues.length === 1 && typeof languageValues[0] !== "string")
  ) {
    return audioErrorResponse(
      "invalid_request",
      "The optional language field must appear at most once.",
      false,
      400,
    );
  }
  const languageValue = languageValues[0];
  const language =
    languageValue === undefined
      ? undefined
      : AudioTranscriptionLanguageSchema.safeParse(languageValue);
  if (language !== undefined && !language.success) {
    return audioErrorResponse(
      "invalid_request",
      "Language must be a two-letter ISO-639-1 code.",
      false,
      400,
    );
  }

  try {
    const upload = await validateAudioUpload(audioFile);
    const result = await transcribeAudioWithOpenAI(
      upload,
      language?.data,
      process.env,
      undefined,
      request.signal,
    );
    return Response.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    return audioFailureResponse(
      error,
      "LectureWeaver could not complete this transcription request.",
    );
  }
}
