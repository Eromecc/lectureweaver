import {
  AudioErrorSchema,
  type AudioErrorCode,
} from "@/domain";

import { ProviderRequestError } from "./errors";
import { AudioRequestError } from "./audio";

export function audioErrorResponse(
  code: AudioErrorCode,
  message: string,
  retryable: boolean,
  status: number,
): Response {
  return Response.json(
    AudioErrorSchema.parse({ error: { code, message, retryable } }),
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export function audioFailureResponse(
  error: unknown,
  fallbackMessage: string,
): Response {
  if (error instanceof AudioRequestError || error instanceof ProviderRequestError) {
    return audioErrorResponse(
      error.code,
      error.message,
      error.retryable,
      error.status,
    );
  }
  return audioErrorResponse(
    "internal_error",
    fallbackMessage,
    true,
    500,
  );
}
