import type { AnalyzeErrorCode } from "@/domain";

export class ProviderRequestError extends Error {
  readonly code: AnalyzeErrorCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(
    code: AnalyzeErrorCode,
    message: string,
    status: number,
    retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderRequestError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function providerHttpError(
  providerLabel: string,
  status: number,
  upstreamIdentifiers: readonly string[] = [],
): ProviderRequestError {
  const identifiers = new Set(
    upstreamIdentifiers.map((identifier) => identifier.trim().toLowerCase()),
  );

  if (
    identifiers.has("content_filter") ||
    identifiers.has("content_filter_error")
  ) {
    return new ProviderRequestError(
      "provider_refusal",
      `${providerLabel} declined to analyze these sources.`,
      422,
      false,
    );
  }

  if (
    identifiers.has("exceeded_current_quota_error") ||
    identifiers.has("insufficient_balance") ||
    identifiers.has("billing_hard_limit_reached") ||
    identifiers.has("insufficient_quota")
  ) {
    return new ProviderRequestError(
      "provider_balance",
      `${providerLabel} reports insufficient API balance.`,
      503,
      false,
    );
  }

  if (status === 401 || status === 403) {
    return new ProviderRequestError(
      "provider_auth",
      `${providerLabel} rejected the supplied API credentials.`,
      503,
      false,
    );
  }

  if (status === 402) {
    return new ProviderRequestError(
      "provider_balance",
      `${providerLabel} reports insufficient API balance.`,
      503,
      false,
    );
  }

  if (status === 429) {
    return new ProviderRequestError(
      "rate_limited",
      `${providerLabel} is rate-limiting analysis requests. Please retry later.`,
      429,
      true,
    );
  }

  return new ProviderRequestError(
    "provider_error",
    `${providerLabel} could not complete the analysis request.`,
    502,
    status >= 500,
  );
}

export function invalidProviderOutput(providerLabel: string): ProviderRequestError {
  return new ProviderRequestError(
    "provider_invalid_output",
    `${providerLabel} returned an analysis that did not pass LectureWeaver's strict schema and evidence checks.`,
    502,
    true,
  );
}
