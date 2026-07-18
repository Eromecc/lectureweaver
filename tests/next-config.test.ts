import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

describe("Next.js security headers", () => {
  it("applies the credential-entry hardening headers to every route", async () => {
    if (nextConfig.headers === undefined) {
      throw new Error("Expected Next.js response headers to be configured.");
    }

    const rules = await nextConfig.headers();

    expect(rules).toContainEqual({
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "no-referrer" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    });
  });
});
