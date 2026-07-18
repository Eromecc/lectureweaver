import {
  AnalyzeErrorSchema,
  AnalyzeRequestSchema,
  AnalyzeSuccessSchema,
  type AnalysisOutputOptions,
  type AnalysisTarget,
  type AnalyzeErrorCode,
  type KimiRegion,
} from "@/domain";
import { buildAnalysisResult, type AnalysisResult } from "@/lib/analysis";
import type { ProcessedSources } from "@/lib/extraction";

import { getProviderLabel } from "./providers";
import {
  SessionProviderKeyError,
  sessionProviderKeyHeaders,
} from "./session-credential";
import { ANALYSIS_CLIENT_TIMEOUT_MS } from "./timeouts";

export class LiveAnalysisError extends Error {
  readonly code: AnalyzeErrorCode;
  readonly retryable: boolean;

  constructor(code: AnalyzeErrorCode, message: string, retryable: boolean) {
    super(message);
    this.name = "LiveAnalysisError";
    this.code = code;
    this.retryable = retryable;
  }
}

export type LiveAnalysisRequestOptions = {
  fetchImpl?: typeof fetch;
  sessionApiKey?: string;
  sessionKimiRegion?: KimiRegion;
};

type LiveAnalysisRequestInput = typeof fetch | LiveAnalysisRequestOptions;

function resolveRequestOptions(
  input: LiveAnalysisRequestInput | undefined,
): Required<Pick<LiveAnalysisRequestOptions, "fetchImpl">> &
  Pick<LiveAnalysisRequestOptions, "sessionApiKey" | "sessionKimiRegion"> {
  return typeof input === "function"
    ? { fetchImpl: input }
    : {
        fetchImpl: input?.fetchImpl ?? fetch,
        sessionApiKey: input?.sessionApiKey,
        sessionKimiRegion: input?.sessionKimiRegion,
      };
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

export async function requestLiveAnalysis(
  processed: ProcessedSources,
  target: AnalysisTarget,
  outputs: AnalysisOutputOptions,
  input?: LiveAnalysisRequestInput,
): Promise<AnalysisResult> {
  const { fetchImpl, sessionApiKey, sessionKimiRegion } =
    resolveRequestOptions(input);
  let credentialHeaders: Record<string, string>;
  try {
    credentialHeaders = sessionProviderKeyHeaders(sessionApiKey);
  } catch (error: unknown) {
    if (error instanceof SessionProviderKeyError) {
      throw new LiveAnalysisError(
        "invalid_request",
        "Enter a valid temporary provider credential.",
        false,
      );
    }
    throw error;
  }
  const credentialMode =
    Object.keys(credentialHeaders).length === 0 ? "deployment" : "session";
  const request = AnalyzeRequestSchema.safeParse({
    ...target,
    credentialMode,
    ...(target.provider === "kimi" && credentialMode === "session"
      ? { kimiRegion: sessionKimiRegion }
      : {}),
    outputs,
    chunks: processed.chunks,
  });
  if (!request.success) {
    throw new LiveAnalysisError(
      "invalid_request",
      "The extracted source map does not satisfy the live-analysis limits.",
      false,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    ANALYSIS_CLIENT_TIMEOUT_MS,
  );
  let response: Response;
  let responseText: string;
  try {
    response = await fetchImpl("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...credentialHeaders,
      },
      body: JSON.stringify(request.data),
      cache: "no-store",
      signal: controller.signal,
    });
    responseText = await response.text();
  } catch (error: unknown) {
    if (isAbortError(error) || controller.signal.aborted) {
      throw new LiveAnalysisError(
        "provider_timeout",
        "The analysis request did not finish within the browser time limit.",
        true,
      );
    }
    throw new LiveAnalysisError(
      "provider_error",
      "The analysis service could not be reached.",
      true,
    );
  } finally {
    clearTimeout(timeout);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(responseText) as unknown;
  } catch {
    if (response.status === 504) {
      throw new LiveAnalysisError(
        "provider_timeout",
        "The analysis service timed out before returning a readable response.",
        true,
      );
    }
    throw new LiveAnalysisError(
      "provider_error",
      "The analysis service returned an unreadable response.",
      true,
    );
  }

  if (!response.ok) {
    const parsedError = AnalyzeErrorSchema.safeParse(payload);
    if (parsedError.success) {
      throw new LiveAnalysisError(
        parsedError.data.error.code,
        parsedError.data.error.message,
        parsedError.data.error.retryable,
      );
    }
    if (response.status === 504) {
      throw new LiveAnalysisError(
        "provider_timeout",
        "The analysis service timed out before returning a valid error response.",
        true,
      );
    }
    throw new LiveAnalysisError(
      "provider_error",
      "The analysis service could not complete the request.",
      response.status >= 500 || response.status === 429,
    );
  }

  const parsed = AnalyzeSuccessSchema.safeParse(payload);
  if (!parsed.success) {
    throw new LiveAnalysisError(
      "provider_invalid_output",
      "The analysis service returned data that failed client validation.",
      true,
    );
  }

  return buildAnalysisResult(
    parsed.data.analysis,
    processed.chunks,
    {
      kind: "live",
      provider: parsed.data.provider,
      providerLabel: getProviderLabel(parsed.data.provider),
      model: parsed.data.model,
    },
    outputs,
  );
}
