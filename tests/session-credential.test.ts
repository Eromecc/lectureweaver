import { describe, expect, it } from "vitest";

import {
  parseSessionProviderKey,
  resolveSessionProviderKey,
  SessionProviderKeyError,
  sessionProviderKeyHeaders,
  SESSION_PROVIDER_KEY_HEADER,
} from "@/lib/ai/session-credential";

describe("temporary provider credentials", () => {
  it("accepts a bounded printable credential without transforming it", () => {
    const credential = "sk-test_ephemeral-123456";

    expect(parseSessionProviderKey(credential)).toBe(credential);
    expect(sessionProviderKeyHeaders(credential)).toEqual({
      [SESSION_PROVIDER_KEY_HEADER]: credential,
    });
  });

  it("treats an absent credential as server-configured mode", () => {
    expect(parseSessionProviderKey(undefined)).toBeUndefined();
    expect(parseSessionProviderKey(null)).toBeUndefined();
    expect(parseSessionProviderKey("")).toBeUndefined();
    expect(sessionProviderKeyHeaders(undefined)).toEqual({});
  });

  it("fails closed when the declared credential mode and header disagree", () => {
    const credential = "temporary-provider-key-123456";

    expect(resolveSessionProviderKey("session", credential)).toBe(credential);
    expect(resolveSessionProviderKey("deployment", undefined)).toBeUndefined();
    expect(() => resolveSessionProviderKey("session", undefined)).toThrow(
      SessionProviderKeyError,
    );
    expect(() => resolveSessionProviderKey("deployment", credential)).toThrow(
      SessionProviderKeyError,
    );
  });

  it("rejects whitespace, controls, short values, and oversized values", () => {
    const invalid = [
      " short-key",
      "short-key ",
      "short\nkey",
      "tiny",
      "x".repeat(513),
    ];

    for (const credential of invalid) {
      expect(() => parseSessionProviderKey(credential)).toThrow(
        SessionProviderKeyError,
      );
    }
  });
});
