import { describe, expect, it, vi } from "vitest";

import { type ModelAnalysis, type SourceChunk } from "@/domain";
import {
  LiveAnalysisError,
  requestLiveAnalysis,
} from "@/lib/ai/client";
import type { ProcessedSources } from "@/lib/extraction";

import { buildTestAnalysis } from "./analysis-fixtures";

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

const processed: ProcessedSources = {
  chunks,
  totalCharacters: chunks.reduce((total, chunk) => total + chunk.text.length, 0),
  counts: { slides: 1, transcript: 1, notes: 1 },
};

const analysis: ModelAnalysis = buildTestAnalysis([
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
]);

describe("live analysis browser client credentials", () => {
  it("sends a temporary key only in its same-origin header", async () => {
    const credential = "temporary-deepseek-key-123456";
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const bodyText = String(init?.body);
      const body = JSON.parse(bodyText) as Record<string, unknown>;

      expect(new Headers(init?.headers).get("x-lectureweaver-provider-key")).toBe(
        credential,
      );
      expect(body).toMatchObject({
        provider: "deepseek",
        model: "deepseek-v4-flash",
        credentialMode: "session",
      });
      expect(body).not.toHaveProperty("kimiRegion");
      expect(bodyText).not.toContain(credential);
      return Response.json({
        provider: "deepseek",
        model: "deepseek-v4-flash",
        analysis,
      });
    });

    const result = await requestLiveAnalysis(
      processed,
      { provider: "deepseek", model: "deepseek-v4-flash" },
      { ankiCards: false },
      { fetchImpl, sessionApiKey: credential },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("/api/analyze");
    expect(result.origin).toMatchObject({
      kind: "live",
      provider: "deepseek",
    });
  });

  it("requires an explicit Kimi region before making a temporary-key request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      requestLiveAnalysis(
        processed,
        { provider: "kimi", model: "kimi-k3" },
        { ankiCards: false },
        { fetchImpl, sessionApiKey: "temporary-kimi-key-123456" },
      ),
    ).rejects.toBeInstanceOf(LiveAnalysisError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("declares deployment mode without sending a temporary header", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_input, init) => {
      const headers = new Headers(init?.headers);
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;

      expect(headers.has("x-lectureweaver-provider-key")).toBe(false);
      expect(body.credentialMode).toBe("deployment");
      return Response.json({
        provider: "openai",
        model: "gpt-5.6",
        analysis,
      });
    });

    await requestLiveAnalysis(
      processed,
      { provider: "openai", model: "gpt-5.6" },
      { ankiCards: false },
      { fetchImpl },
    );

    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
