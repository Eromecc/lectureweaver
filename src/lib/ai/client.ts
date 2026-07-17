import {
  AnalyzeErrorSchema,
  AnalyzeRequestSchema,
  AnalyzeSuccessSchema,
  type AnalysisTarget,
  type AnalyzeErrorCode,
} from "@/domain";
import { buildAnalysisResult, type AnalysisResult } from "@/lib/analysis";
import type { ProcessedSources } from "@/lib/extraction";

import { getProviderLabel } from "./providers";

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

export async function requestLiveAnalysis(
  processed: ProcessedSources,
  target: AnalysisTarget,
  fetchImpl: typeof fetch = fetch,
): Promise<AnalysisResult> {
  const request = AnalyzeRequestSchema.safeParse({
    ...target,
    chunks: processed.chunks,
  });
  if (!request.success) {
    throw new LiveAnalysisError(
      "invalid_request",
      "The extracted source map does not satisfy the live-analysis limits.",
      false,
    );
  }

  let response: Response;
  try {
    response = await fetchImpl("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.data),
      cache: "no-store",
    });
  } catch {
    throw new LiveAnalysisError(
      "provider_error",
      "The analysis service could not be reached.",
      true,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(await response.text()) as unknown;
  } catch {
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

  return buildAnalysisResult(parsed.data.analysis, processed.chunks, {
    kind: "live",
    provider: parsed.data.provider,
    providerLabel: getProviderLabel(parsed.data.provider),
    model: parsed.data.model,
  });
}
