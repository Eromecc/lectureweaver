import {
  AnalyzeErrorSchema,
  AnalyzeRequestSchema,
  AnalyzeSuccessSchema,
  type AnalyzeErrorCode,
} from "@/domain";
import { ProviderRequestError } from "@/lib/ai/errors";
import {
  resolveSessionProviderKey,
  SessionProviderKeyError,
  SESSION_PROVIDER_KEY_HEADER,
} from "@/lib/ai/session-credential";
import { analyzeWithSelectedProvider } from "@/lib/ai/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_REQUEST_BODY_BYTES = 1_000_000;

class RequestBodyTooLargeError extends Error {}

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
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError();
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join("");
  } finally {
    reader.releaseLock();
  }
}

function errorResponse(
  code: AnalyzeErrorCode,
  message: string,
  retryable: boolean,
  status: number,
): Response {
  const body = AnalyzeErrorSchema.parse({
    error: { code, message, retryable },
  });
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const mediaType =
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ??
    "";
  if (mediaType !== "application/json") {
    return errorResponse(
      "invalid_request",
      "Analysis requests must use application/json.",
      false,
      415,
    );
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
    return errorResponse(
      "request_too_large",
      "The analysis request body is too large.",
      false,
      413,
    );
  }

  let text: string;
  try {
    text = await readRequestBody(request);
  } catch (error: unknown) {
    if (error instanceof RequestBodyTooLargeError) {
      return errorResponse(
        "request_too_large",
        "The analysis request body is too large.",
        false,
        413,
      );
    }
    return errorResponse(
      "invalid_request",
      "The analysis request body could not be read.",
      false,
      400,
    );
  }

  let input: unknown;
  try {
    input = JSON.parse(text) as unknown;
  } catch {
    return errorResponse(
      "invalid_request",
      "The analysis request body must contain valid JSON.",
      false,
      400,
    );
  }

  const parsed = AnalyzeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return errorResponse(
      "invalid_request",
      "The analysis request did not match the required source contract.",
      false,
      400,
    );
  }

  let sessionApiKey: string | undefined;
  try {
    sessionApiKey = resolveSessionProviderKey(
      parsed.data.credentialMode,
      request.headers.get(SESSION_PROVIDER_KEY_HEADER),
    );
  } catch (error: unknown) {
    return errorResponse(
      "invalid_request",
      error instanceof SessionProviderKeyError
        ? "The temporary provider credential is missing or invalid."
        : "The temporary provider credential could not be read.",
      false,
      400,
    );
  }

  try {
    const result = AnalyzeSuccessSchema.parse(
      await analyzeWithSelectedProvider(
        parsed.data,
        process.env,
        undefined,
        sessionApiKey,
      ),
    );
    return Response.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    if (error instanceof ProviderRequestError) {
      return errorResponse(
        error.code,
        error.message,
        error.retryable,
        error.status,
      );
    }
    return errorResponse(
      "internal_error",
      "LectureWeaver could not complete this analysis request.",
      true,
      500,
    );
  }
}
