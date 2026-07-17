import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnalyzeErrorSchema,
  AnalyzeSuccessSchema,
  type AnalyzeRequest,
  type SourceChunk,
} from "@/domain";
import { POST } from "@/app/api/analyze/route";
import type { ModelAnalysisWire } from "@/lib/ai/wire";

const chunks: SourceChunk[] = [
  {
    id: "slides:p0001:c01",
    sourceType: "slides",
    sourceName: "lecture.pdf",
    locator: "Page 1",
    text: "Spacing distributes practice over time.",
  },
  {
    id: "transcript:p0001:c01",
    sourceType: "transcript",
    sourceName: "transcript.txt",
    locator: "Paragraph 1",
    text: "Spacing improves durable retrieval.",
  },
  {
    id: "notes:p0001:c01",
    sourceType: "notes",
    sourceName: "notes.md",
    locator: "Paragraph 1",
    text: "Space practice across days.",
  },
];

function analyzeRequest(model = "deepseek-v4-flash"): AnalyzeRequest {
  return { provider: "deepseek", model, chunks };
}

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
}

function validWireAnalysis(): ModelAnalysisWire {
  return {
    summary: "The notes capture the central idea.",
    assessments: [
      {
        id: "spacing",
        title: "Spacing",
        importance: "core",
        status: "covered",
        explanation: "The notes preserve the lecture explanation.",
        evidenceRefs: [
          { chunkId: "slides:p0001:c01", relevance: "Defines spacing." },
          { chunkId: "notes:p0001:c01", relevance: "Preserves spacing." },
        ],
        suggestedPatch: null,
      },
    ],
  };
}

async function responsePayload(response: Response): Promise<unknown> {
  return JSON.parse(await response.text()) as unknown;
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("DEEPSEEK_API_KEY", "");
  vi.stubEnv("KIMI_API_KEY", "");
  vi.stubEnv("OPENAI_MODEL", "");
  vi.stubEnv("DEEPSEEK_MODEL", "");
  vi.stubEnv("KIMI_MODEL", "");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/analyze", () => {
  it("rejects non-JSON content types", async () => {
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "{}",
      }),
    );
    const payload = AnalyzeErrorSchema.parse(await responsePayload(response));

    expect(response.status).toBe(415);
    expect(payload.error).toMatchObject({
      code: "invalid_request",
      retryable: false,
    });

    const jsonp = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/jsonp" },
        body: "{}",
      }),
    );
    expect(jsonp.status).toBe(415);
  });

  it("rejects malformed JSON and oversized bodies before provider work", async () => {
    const malformed = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json}",
      }),
    );
    const oversized = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: `"${"x".repeat(1_000_001)}"`,
      }),
    );

    expect(malformed.status).toBe(400);
    expect(AnalyzeErrorSchema.parse(await responsePayload(malformed)).error.code).toBe(
      "invalid_request",
    );
    expect(oversized.status).toBe(413);
    expect(AnalyzeErrorSchema.parse(await responsePayload(oversized)).error.code).toBe(
      "request_too_large",
    );
  });

  it("rejects a provider with no server-side key", async () => {
    const response = await POST(jsonRequest(analyzeRequest()));
    const payload = AnalyzeErrorSchema.parse(await responsePayload(response));

    expect(response.status).toBe(503);
    expect(payload.error).toEqual({
      code: "provider_not_configured",
      message: "The selected model provider is not configured on this deployment.",
      retryable: false,
    });
  });

  it("rejects models outside the deployment allowlist", async () => {
    const response = await POST(jsonRequest(analyzeRequest("unknown-model")));
    const payload = AnalyzeErrorSchema.parse(await responsePayload(response));

    expect(response.status).toBe(400);
    expect(payload.error).toMatchObject({
      code: "unsupported_model",
      retryable: false,
    });
  });

  it("does not expose provider response bodies or fake credentials", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "fake-route-secret");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response("private upstream account detail", { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest(analyzeRequest()));
    const text = await response.text();
    const payload = AnalyzeErrorSchema.parse(JSON.parse(text) as unknown);

    expect(response.status).toBe(503);
    expect(payload.error).toMatchObject({
      code: "provider_auth",
      retryable: false,
    });
    expect(text).not.toContain("private upstream account detail");
    expect(text).not.toContain("fake-route-secret");
  });

  it("returns a validated success from a fully mocked provider call", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "fake-route-key");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(validWireAnalysis()) },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(jsonRequest(analyzeRequest()));
    const payload = AnalyzeSuccessSchema.parse(await responsePayload(response));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload).toMatchObject({
      provider: "deepseek",
      model: "deepseek-v4-flash",
      analysis: { summary: "The notes capture the central idea." },
    });
    expect(payload.analysis.assessments[0]).not.toHaveProperty("suggestedPatch");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
