import { z } from "zod";

import type { CredentialMode } from "@/domain";

export const SESSION_PROVIDER_KEY_HEADER = "x-lectureweaver-provider-key";

export const SessionProviderKeySchema = z
  .string()
  .min(8)
  .max(512)
  .refine((value) => value === value.trim(), {
    message: "API keys cannot start or end with whitespace.",
  })
  .regex(/^[\x21-\x7e]+$/u, "API keys must use printable ASCII characters.");

export class SessionProviderKeyError extends Error {
  constructor() {
    super("The temporary provider credential is invalid.");
    this.name = "SessionProviderKeyError";
  }
}

export function parseSessionProviderKey(
  value: string | null | undefined,
): string | undefined {
  if (value === null || value === undefined || value.length === 0) {
    return undefined;
  }

  const parsed = SessionProviderKeySchema.safeParse(value);
  if (!parsed.success) throw new SessionProviderKeyError();
  return parsed.data;
}

export function sessionProviderKeyHeaders(
  value: string | null | undefined,
): Record<string, string> {
  const parsed = parseSessionProviderKey(value);
  return parsed === undefined
    ? {}
    : { [SESSION_PROVIDER_KEY_HEADER]: parsed };
}

export function resolveSessionProviderKey(
  mode: CredentialMode,
  headerValue: string | null | undefined,
): string | undefined {
  const apiKey = parseSessionProviderKey(headerValue);
  if (mode === "session") {
    if (apiKey === undefined) throw new SessionProviderKeyError();
    return apiKey;
  }
  if (mode === "deployment") {
    if (apiKey !== undefined) throw new SessionProviderKeyError();
    return undefined;
  }
  throw new SessionProviderKeyError();
}
