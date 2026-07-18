import {
  AudioSpeechFormatSchema,
  MAX_SPEECH_INPUT_CHARACTERS,
  SpeechApiRequestSchema,
  type SpeechRequest,
} from "@/domain";
import { createSpeechWithOpenAI } from "@/lib/ai/audio";
import {
  audioErrorResponse,
  audioFailureResponse,
} from "@/lib/ai/audio-http";
import {
  resolveSessionProviderKey,
  SessionProviderKeyError,
  SESSION_PROVIDER_KEY_HEADER,
} from "@/lib/ai/session-credential";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_SPEECH_REQUEST_BODY_BYTES = MAX_SPEECH_INPUT_CHARACTERS * 4 + 1_024;

class SpeechBodyTooLargeError extends Error {}

async function readRequestBody(request: Request): Promise<string> {
  if (request.body === null) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const parts: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_SPEECH_REQUEST_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new SpeechBodyTooLargeError();
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    reader.releaseLock();
  }
}

function speechContentType(format: string): string {
  return AudioSpeechFormatSchema.parse(format) === "wav"
    ? "audio/wav"
    : "audio/mpeg";
}

export async function POST(request: Request): Promise<Response> {
  const mediaType =
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ??
    "";
  if (mediaType !== "application/json") {
    return audioErrorResponse(
      "invalid_request",
      "Speech requests must use application/json.",
      false,
      415,
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_SPEECH_REQUEST_BODY_BYTES
  ) {
    return audioErrorResponse(
      "request_too_large",
      "The speech request body is too large.",
      false,
      413,
    );
  }

  let body: string;
  try {
    body = await readRequestBody(request);
  } catch (error: unknown) {
    if (error instanceof SpeechBodyTooLargeError) {
      return audioErrorResponse(
        "request_too_large",
        "The speech request body is too large.",
        false,
        413,
      );
    }
    return audioErrorResponse(
      "invalid_request",
      "The speech request body could not be read as UTF-8.",
      false,
      400,
    );
  }

  let input: unknown;
  try {
    input = JSON.parse(body) as unknown;
  } catch {
    return audioErrorResponse(
      "invalid_request",
      "The speech request body must contain valid JSON.",
      false,
      400,
    );
  }

  const parsed = SpeechApiRequestSchema.safeParse(input);
  if (!parsed.success) {
    return audioErrorResponse(
      "invalid_request",
      "The speech request did not match the required narration contract.",
      false,
      400,
    );
  }

  const { credentialMode } = parsed.data;
  let sessionApiKey: string | undefined;
  try {
    sessionApiKey = resolveSessionProviderKey(
      credentialMode,
      request.headers.get(SESSION_PROVIDER_KEY_HEADER),
    );
  } catch (error: unknown) {
    return audioErrorResponse(
      "invalid_request",
      error instanceof SessionProviderKeyError
        ? "The credential mode does not match the supplied OpenAI credential."
        : "The OpenAI credential could not be read.",
      false,
      400,
    );
  }

  const speechRequest: SpeechRequest = {
    text: parsed.data.text,
    voice: parsed.data.voice,
    format: parsed.data.format,
  };

  try {
    const speech = await createSpeechWithOpenAI(
      speechRequest,
      process.env,
      undefined,
      request.signal,
      credentialMode,
      sessionApiKey,
    );
    return new Response(speech.response.body, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="lectureweaver-study-audio.${speechRequest.format}"`,
        "Content-Type": speechContentType(speechRequest.format),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: unknown) {
    return audioFailureResponse(
      error,
      "LectureWeaver could not complete this speech request.",
    );
  }
}
