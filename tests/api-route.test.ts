import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AnalyzeErrorSchema,
  AnalyzeSuccessSchema,
  type AnalyzeRequest,
  type SourceChunk,
} from "@/domain";
import { maxDuration, POST } from "@/app/api/analyze/route";
import {
  ANALYSIS_CLIENT_TIMEOUT_MS,
  ANALYSIS_PROVIDER_TIMEOUT_MS,
} from "@/lib/ai/timeouts";
import type { ModelAnalysisWire } from "@/lib/ai/wire";

import { buildTestAnalysis, toWireAnalysis } from "./analysis-fixtures";

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
  return {
    provider: "deepseek",
    model,
    credentialMode: "deployment",
    outputLanguage: "en",
    outputs: { ankiCards: true },
    chunks,
  };
}

function jsonRequest(body: unknown, sessionApiKey?: string): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(sessionApiKey === undefined
        ? {}
        : { "X-LectureWeaver-Provider-Key": sessionApiKey }),
    },
    body: JSON.stringify(body),
  });
}

function validWireAnalysis(): ModelAnalysisWire {
  return toWireAnalysis(
    buildTestAnalysis(
      [
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
        },
      ],
      {
        summary: "The notes capture the central idea.",
        includeAnki: true,
      },
    ),
  );
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
  it("allows the provider timeout to complete before the route deadline", () => {
    expect(ANALYSIS_PROVIDER_TIMEOUT_MS).toBe(150_000);
    expect(ANALYSIS_CLIENT_TIMEOUT_MS).toBe(170_000);
    expect(ANALYSIS_PROVIDER_TIMEOUT_MS).toBeLessThan(
      ANALYSIS_CLIENT_TIMEOUT_MS,
    );
    expect(ANALYSIS_CLIENT_TIMEOUT_MS).toBeLessThan(maxDuration * 1_000);
    expect(maxDuration).toBe(180);
  });

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

  it("uses a validated temporary credential without persisting or returning it", async () => {
    const credential = "temporary-deepseek-key-123456";
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe(
        `Bearer ${credential}`,
      );
      return Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(validWireAnalysis()) },
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      jsonRequest(
        { ...analyzeRequest(), credentialMode: "session" },
        credential,
      ),
    );
    const text = await response.text();
    const payload = AnalyzeSuccessSchema.parse(JSON.parse(text) as unknown);

    expect(response.status, text).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.provider).toBe("deepseek");
    expect(text).not.toContain(credential);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects malformed temporary credentials before provider work", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      jsonRequest(
        { ...analyzeRequest(), credentialMode: "session" },
        " bad-key",
      ),
    );
    const text = await response.text();
    const payload = AnalyzeErrorSchema.parse(JSON.parse(text) as unknown);

    expect(response.status).toBe(400);
    expect(payload.error).toMatchObject({
      code: "invalid_request",
      retryable: false,
    });
    expect(text).not.toContain("bad-key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fall back to a deployment key when session mode lacks its header", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "deployment-key-must-not-be-used");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      jsonRequest({ ...analyzeRequest(), credentialMode: "session" }),
    );
    const text = await response.text();
    const payload = AnalyzeErrorSchema.parse(JSON.parse(text) as unknown);

    expect(response.status).toBe(400);
    expect(payload.error).toMatchObject({
      code: "invalid_request",
      retryable: false,
    });
    expect(text).not.toContain("deployment-key-must-not-be-used");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an omitted credential mode before provider work", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "deployment-key-must-not-be-used");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const withoutCredentialMode: Partial<AnalyzeRequest> = {
      ...analyzeRequest(),
    };
    delete withoutCredentialMode.credentialMode;

    const response = await POST(jsonRequest(withoutCredentialMode));
    const text = await response.text();
    const payload = AnalyzeErrorSchema.parse(JSON.parse(text) as unknown);

    expect(response.status).toBe(400);
    expect(payload.error).toMatchObject({
      code: "invalid_request",
      retryable: false,
    });
    expect(text).not.toContain("deployment-key-must-not-be-used");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an unsupported output language before provider work", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "deployment-key-must-not-be-used");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      jsonRequest({ ...analyzeRequest(), outputLanguage: "fr" }),
    );
    const payload = AnalyzeErrorSchema.parse(await responsePayload(response));

    expect(response.status).toBe(400);
    expect(payload.error).toMatchObject({
      code: "invalid_request",
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a temporary header in deployment mode", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "deployment-key-must-not-be-used");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      jsonRequest(analyzeRequest(), "unexpected-temporary-key"),
    );

    expect(response.status).toBe(400);
    expect(AnalyzeErrorSchema.parse(await responsePayload(response)).error).toMatchObject({
      code: "invalid_request",
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
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
