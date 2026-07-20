import OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AnalyzeRequestSchema,
  MAX_CHUNK_CHARACTERS,
  MAX_EXTRACTED_CHARACTERS,
  MAX_SOURCE_CHUNKS,
  type ModelAnalysis,
  type SourceChunk,
} from "@/domain";
import {
  getPublicProviderCatalog,
  isAllowedAnalysisTarget,
} from "@/lib/ai/catalog";
import { analyzeWithChatCompletions } from "@/lib/ai/chat-completions";
import { parseDeepSeekAnalysisText } from "@/lib/ai/deepseek-normalize";
import {
  analyzeWithOpenAI,
  interpretOpenAIResponse,
  type OpenAIInvoker,
} from "@/lib/ai/openai";
import {
  analyzeWithSelectedProvider,
  type ProviderAnalyzer,
  type ProviderAnalyzers,
} from "@/lib/ai/server";
import { validateModelAnalysisAgainstChunks } from "@/lib/analysis";
import {
  parseModelAnalysisText,
  parseModelAnalysisWire,
  type ModelAnalysisWire,
} from "@/lib/ai/wire";
import { buildAnalysisInput } from "@/lib/ai/prompt";
import { ANALYSIS_PROVIDER_TIMEOUT_MS } from "@/lib/ai/timeouts";

import { buildTestAnalysis, toWireAnalysis } from "./analysis-fixtures";

const sourceChunks: SourceChunk[] = [
  {
    id: "slides:p0001:c01",
    sourceType: "slides",
    sourceName: "lecture.pdf",
    locator: "Page 1",
    text: "Spacing distributes study over time.",
  },
  {
    id: "transcript:p0001:c01",
    sourceType: "transcript",
    sourceName: "transcript.txt",
    locator: "Paragraph 1",
    text: "The lecture explains why retrieval should be effortful.",
  },
  {
    id: "notes:p0001:c01",
    sourceType: "notes",
    sourceName: "notes.md",
    locator: "Paragraph 1",
    text: "Space reviews over several days.",
  },
];

function validWireAnalysis(): ModelAnalysisWire {
  return toWireAnalysis(
    buildTestAnalysis(
      [
        {
        id: "spacing",
        title: "Spacing",
        importance: "core",
        status: "covered",
        explanation: "The notes retain the important explanation.",
        evidenceRefs: [
          {
            chunkId: "slides:p0001:c01",
            relevance: "The slide defines spacing.",
          },
          {
            chunkId: "notes:p0001:c01",
            relevance: "The notes preserve the definition.",
          },
        ],
        },
      ],
      {
        summary: "The notes preserve the main spacing concept.",
        includeAnki: true,
      },
    ),
  );
}

function completionEnvelope(
  content: string = JSON.stringify(validWireAnalysis()),
  finishReason = "stop",
): object {
  return {
    choices: [
      {
        finish_reason: finishReason,
        message: { content },
      },
    ],
  };
}

function repairableDeepSeekAnalysis(): object {
  return {
    summary: "The notes preserve the main spacing concept.",
    assessments: [
      {
        id: "spacing",
        title: "Spacing",
        importance: " CORE ",
        status: " COVERED ",
        explanation: "The notes retain the important explanation.",
        evidenceRefs: [
          {
            chunkId: "slides:p0001:c01",
            relevance: "The slide defines spacing.",
          },
          {
            chunkId: "notes:p0001:c01",
            relevance: "The notes preserve the definition.",
          },
        ],
      },
    ],
    enhancedNotes: {
      title: "Spacing study guide",
      overview: "# Orientation\n\nSpacing connects review sessions over time.",
      sections: [
        {
          id: "section-spacing",
          heading: "Spacing",
          learningObjective: "Understand why spacing supports retention.",
          changeType: " NEW ",
          markdown:
            "## Spacing mechanism\n\nSpace reviews over time.\n\n```text\nnot a heading\n```",
          assessmentIds: ["spacing"],
          evidenceRefs: [
            {
              chunkId: "transcript:p0001:c01",
              relevance: "A trusted but unrelated redundant reference.",
            },
          ],
        },
      ],
    },
    ankiCards: [
      {
        id: "card-spacing",
        front: "What is spacing?",
        back: "Distributing study over time.",
        assessmentIds: ["spacing"],
        evidenceRefs: null,
      },
    ],
  };
}

function analyzersUsing(analyzer: ProviderAnalyzer): ProviderAnalyzers {
  return { openai: analyzer, deepseek: analyzer, kimi: analyzer };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AI provider catalog and request contract", () => {
  it("uses safe unconfigured defaults and allowlists only catalog models", () => {
    const catalog = getPublicProviderCatalog({});

    expect(catalog.providers).toMatchObject([
      {
        id: "openai",
        configured: false,
        defaultModel: "gpt-5.6",
      },
      {
        id: "deepseek",
        configured: false,
        defaultModel: "deepseek-v4-flash",
      },
      { id: "kimi", configured: false, defaultModel: "kimi-k3" },
    ]);
    expect(
      isAllowedAnalysisTarget(
        { provider: "deepseek", model: "deepseek-v4-pro" },
        catalog,
      ),
    ).toBe(true);
    expect(
      isAllowedAnalysisTarget(
        { provider: "deepseek", model: "gpt-5.6" },
        catalog,
      ),
    ).toBe(false);
  });

  it("adds a valid deployment model and falls back from invalid env values", () => {
    const catalog = getPublicProviderCatalog({
      OPENAI_API_KEY: "  test-openai-key  ",
      OPENAI_MODEL: "org.custom-model:1",
      DEEPSEEK_API_KEY: "   ",
      DEEPSEEK_MODEL: "bad model id",
    });
    const openai = catalog.providers.find((provider) => provider.id === "openai");
    const deepseek = catalog.providers.find(
      (provider) => provider.id === "deepseek",
    );

    expect(openai).toMatchObject({
      configured: true,
      defaultModel: "org.custom-model:1",
    });
    expect(openai?.models[0]?.id).toBe("org.custom-model:1");
    expect(deepseek).toMatchObject({
      configured: false,
      defaultModel: "deepseek-v4-flash",
    });
  });

  it("accepts any lecture source, keeps notes optional, and rejects unsafe maps", () => {
    const base = {
      provider: "openai",
      model: "gpt-5.6",
      credentialMode: "deployment",
      outputs: { ankiCards: true },
    } as const;
    const slides = sourceChunks[0]!;
    const transcript = sourceChunks[1]!;
    const notes = sourceChunks[2]!;

    for (const chunks of [
      [slides],
      [transcript],
      [slides, notes],
      [transcript, notes],
      [slides, transcript],
    ]) {
      expect(AnalyzeRequestSchema.safeParse({ ...base, chunks }).success).toBe(
        true,
      );
    }

    const notesOnly = AnalyzeRequestSchema.safeParse({
      ...base,
      chunks: [notes],
    });
    const empty = AnalyzeRequestSchema.safeParse({ ...base, chunks: [] });
    const duplicate = AnalyzeRequestSchema.safeParse({
      ...base,
      chunks: [...sourceChunks, { ...sourceChunks[0] }],
    });

    expect(notesOnly.success).toBe(false);
    expect(empty.success).toBe(false);
    expect(duplicate.success).toBe(false);
    if (!notesOnly.success) {
      expect(
        notesOnly.error.issues.some((issue) =>
          issue.message.includes("slides or transcript"),
        ),
      ).toBe(
        true,
      );
    }
    if (!duplicate.success) {
      expect(
        duplicate.error.issues.some((issue) => issue.message.includes("Duplicate")),
      ).toBe(true);
    }
  });

  it("requires an explicit region only for temporary Kimi credentials", () => {
    const base = {
      provider: "kimi" as const,
      model: "kimi-k3",
      outputs: { ankiCards: true },
      chunks: sourceChunks,
    };

    expect(
      AnalyzeRequestSchema.safeParse({ ...base, credentialMode: "session" })
        .success,
    ).toBe(false);
    expect(
      AnalyzeRequestSchema.safeParse({
        ...base,
        credentialMode: "session",
        kimiRegion: "global",
      }).success,
    ).toBe(true);
    expect(
      AnalyzeRequestSchema.safeParse({
        ...base,
        credentialMode: "deployment",
        kimiRegion: "cn",
      }).success,
    ).toBe(false);
    expect(
      AnalyzeRequestSchema.safeParse({
        ...base,
        provider: "openai",
        model: "gpt-5.6",
        credentialMode: "session",
        kimiRegion: "cn",
      }).success,
    ).toBe(false);
  });

  it("requires an explicit credential mode", () => {
    expect(
      AnalyzeRequestSchema.safeParse({
        provider: "openai",
        model: "gpt-5.6",
        outputs: { ankiCards: true },
        chunks: sourceChunks,
      }).success,
    ).toBe(false);
  });

  it("defaults the output language to English and rejects unsupported languages", () => {
    const request = AnalyzeRequestSchema.parse({
      provider: "openai",
      model: "gpt-5.6",
      credentialMode: "deployment",
      outputs: { ankiCards: true },
      chunks: sourceChunks,
    });

    expect(request.outputLanguage).toBe("en");
    expect(
      AnalyzeRequestSchema.safeParse({
        ...request,
        outputLanguage: "fr",
      }).success,
    ).toBe(false);
  });

  it("enforces per-chunk, aggregate, and chunk-count caps", () => {
    const oversizedChunk = AnalyzeRequestSchema.safeParse({
      provider: "openai",
      model: "gpt-5.6",
      credentialMode: "deployment",
      outputs: { ankiCards: true },
      chunks: [
        { ...sourceChunks[0], text: "x".repeat(MAX_CHUNK_CHARACTERS + 1) },
        sourceChunks[1],
        sourceChunks[2],
      ],
    });
    const aggregateChunks: SourceChunk[] = Array.from({ length: 67 }, (_, index) => ({
      id: `chunk-${index}`,
      sourceType: (["slides", "transcript", "notes"] as const)[index % 3] ?? "notes",
      sourceName: `source-${index}.txt`,
      locator: `Part ${index}`,
      text: "x".repeat(MAX_CHUNK_CHARACTERS),
    }));
    const aggregate = AnalyzeRequestSchema.safeParse({
      provider: "openai",
      model: "gpt-5.6",
      credentialMode: "deployment",
      outputs: { ankiCards: true },
      chunks: aggregateChunks,
    });
    const tooMany = AnalyzeRequestSchema.safeParse({
      provider: "openai",
      model: "gpt-5.6",
      credentialMode: "deployment",
      outputs: { ankiCards: true },
      chunks: Array.from({ length: MAX_SOURCE_CHUNKS + 1 }, (_, index) => ({
        ...sourceChunks[index % sourceChunks.length],
        id: `many-${index}`,
      })),
    });

    expect(oversizedChunk.success).toBe(false);
    expect(aggregate.success).toBe(false);
    expect(aggregateChunks.reduce((sum, chunk) => sum + chunk.text.length, 0)).toBeGreaterThan(
      MAX_EXTRACTED_CHARACTERS,
    );
    expect(tooMany.success).toBe(false);
  });
});

describe("wire parsing and OpenAI injection", () => {
  it("normalizes nullable wire patches before strict domain parsing", () => {
    const parsed = parseModelAnalysisWire(validWireAnalysis());

    expect(parsed.assessments[0]).not.toHaveProperty("suggestedPatch");
    expect(parseModelAnalysisText(`\n${JSON.stringify(validWireAnalysis())}\n`)).toEqual(
      parsed,
    );
  });

  it("rejects empty, malformed, and schema-drifting provider output", () => {
    expect(() => parseModelAnalysisText("   ")).toThrow();
    expect(() => parseModelAnalysisText("{not-json}")).toThrow();
    expect(() =>
      parseModelAnalysisWire({ ...validWireAnalysis(), untrusted: true }),
    ).toThrow();
  });

  it.each([
    "<img src=x onerror=alert(1)>",
    "![remote tracker](https://example.test/pixel.png)",
    "[unsafe destination](javascript:alert(1))",
    "[Review source]: /external-target\n\n[Review source]",
    "Read more at https://example.test/tracker.",
  ])("rejects active Markdown in suggested patches: %s", (suggestedPatch) => {
    const covered = validWireAnalysis().assessments[0];
    const primaryEvidence = covered?.evidenceRefs[0];
    if (covered === undefined || primaryEvidence === undefined) {
      throw new Error("The test fixture must include primary evidence.");
    }
    expect(() =>
      parseModelAnalysisWire({
        summary: "Unsafe generated patch.",
        assessments: [
          {
            ...covered,
            status: "missing",
            evidenceRefs: [primaryEvidence],
            suggestedPatch,
          },
        ],
      }),
    ).toThrow();
  });

  it("uses an injected OpenAI invoker without making a network request", async () => {
    const invoke = vi.fn<OpenAIInvoker>(async () => validWireAnalysis());

    const result = await analyzeWithOpenAI(
      { apiKey: "fake-openai-key", model: "gpt-5.6", chunks: sourceChunks },
      invoke,
    );

    expect(result.assessments[0]).not.toHaveProperty("suggestedPatch");
    expect(invoke).toHaveBeenCalledWith({
      apiKey: "fake-openai-key",
      model: "gpt-5.6",
      chunks: sourceChunks,
    });
  });

  it("maps malformed injected OpenAI output to a safe provider error", async () => {
    const invoke = vi.fn<OpenAIInvoker>(async () => ({
      ...validWireAnalysis(),
      unexpected: "schema drift",
    }));

    await expect(
      analyzeWithOpenAI(
        { apiKey: "fake-openai-key", model: "gpt-5.6", chunks: sourceChunks },
        invoke,
      ),
    ).rejects.toMatchObject({
      code: "provider_invalid_output",
      status: 502,
      retryable: true,
    });
  });

  it("distinguishes OpenAI refusal and incomplete-length responses", () => {
    expect(() =>
      interpretOpenAIResponse({
        status: "incomplete",
        incomplete_details: { reason: "content_filter" },
        output_parsed: null,
        output: [],
      }),
    ).toThrow(expect.objectContaining({ code: "provider_refusal" }));

    expect(() =>
      interpretOpenAIResponse({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_parsed: null,
        output: [],
      }),
    ).toThrow(expect.objectContaining({ code: "provider_invalid_output" }));

    expect(() =>
      interpretOpenAIResponse({
        status: "completed",
        incomplete_details: null,
        output_parsed: null,
        output: [{ type: "message", content: [{ type: "refusal" }] }],
      }),
    ).toThrow(expect.objectContaining({ code: "provider_refusal" }));
  });

  it("maps OpenAI timeout and exhausted-quota errors without leaking details", async () => {
    const timeoutInvoke = vi.fn<OpenAIInvoker>(async () => {
      throw new OpenAI.APIConnectionTimeoutError();
    });
    const quotaError = OpenAI.APIError.generate(
      429,
      {
        error: {
          code: "insufficient_quota",
          type: "insufficient_quota",
          message: "private account detail",
        },
      },
      "private account detail",
      new Headers(),
    );
    const quotaInvoke = vi.fn<OpenAIInvoker>(async () => {
      throw quotaError;
    });
    const invocation = {
      apiKey: "fake-openai-key",
      model: "gpt-5.6",
      chunks: sourceChunks,
    };

    await expect(
      analyzeWithOpenAI(invocation, timeoutInvoke),
    ).rejects.toMatchObject({ code: "provider_timeout", retryable: true });
    await expect(
      analyzeWithOpenAI(invocation, quotaInvoke),
    ).rejects.toMatchObject({ code: "provider_balance", retryable: false });
    await expect(analyzeWithOpenAI(invocation, quotaInvoke)).rejects.not.toHaveProperty(
      "message",
      expect.stringContaining("private account detail"),
    );
  });

  it("revalidates injected provider analysis against trusted chunks in the server", async () => {
    const invalidAnalysis: ModelAnalysis = buildTestAnalysis(
      [
        {
          id: "invented-evidence",
          title: "Invented evidence",
          importance: "core",
          status: "missing",
          explanation: "This must fail semantic validation.",
          evidenceRefs: [
            { chunkId: "slides:p9999:c01", relevance: "Not a trusted chunk." },
          ],
          suggestedPatch: "Add a grounded explanation.",
        },
      ],
      { summary: "Looks structurally valid but cites an invented chunk." },
    );
    const analyzer = vi.fn<ProviderAnalyzer>(async () => invalidAnalysis);
    const request = AnalyzeRequestSchema.parse({
      provider: "openai",
      model: "gpt-5.6",
      credentialMode: "deployment",
      outputs: { ankiCards: false },
      chunks: sourceChunks,
    });

    await expect(
      analyzeWithSelectedProvider(
        request,
        { OPENAI_API_KEY: "fake-openai-key" },
        analyzersUsing(analyzer),
      ),
    ).rejects.toMatchObject({
      code: "provider_invalid_output",
      status: 502,
    });
  });

  it("fails closed across mismatched credential modes in the server helper", async () => {
    const analyzer = vi.fn<ProviderAnalyzer>(async () =>
      parseModelAnalysisWire(validWireAnalysis()),
    );
    const sessionRequest = AnalyzeRequestSchema.parse({
      provider: "openai",
      model: "gpt-5.6",
      credentialMode: "session",
      outputs: { ankiCards: true },
      chunks: sourceChunks,
    });
    const deploymentRequest = AnalyzeRequestSchema.parse({
      provider: "openai",
      model: "gpt-5.6",
      credentialMode: "deployment",
      outputs: { ankiCards: true },
      chunks: sourceChunks,
    });

    await expect(
      analyzeWithSelectedProvider(
        sessionRequest,
        { OPENAI_API_KEY: "deployment-key-must-not-be-used" },
        analyzersUsing(analyzer),
      ),
    ).rejects.toMatchObject({ code: "invalid_request", status: 400 });
    await expect(
      analyzeWithSelectedProvider(
        deploymentRequest,
        { OPENAI_API_KEY: "deployment-key-must-not-be-used" },
        analyzersUsing(analyzer),
        "unexpected-temporary-key",
      ),
    ).rejects.toMatchObject({ code: "invalid_request", status: 400 });
    expect(analyzer).not.toHaveBeenCalled();
  });

  it("selects the allowlisted global Kimi endpoint on the server", async () => {
    const analyzer = vi.fn<ProviderAnalyzer>(async () =>
      parseModelAnalysisWire(validWireAnalysis()),
    );
    const request = AnalyzeRequestSchema.parse({
      provider: "kimi",
      model: "kimi-k3",
      credentialMode: "deployment",
      outputLanguage: "ja",
      outputs: { ankiCards: true },
      chunks: sourceChunks,
    });

    await analyzeWithSelectedProvider(
      request,
      { KIMI_API_KEY: "fake-kimi-key", KIMI_REGION: "global" },
      analyzersUsing(analyzer),
    );

    expect(analyzer).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "kimi",
        baseUrl: "https://api.moonshot.ai/v1",
        outputLanguage: "ja",
      }),
    );
  });

  it("uses the temporary Kimi key and its explicit region independently of deployment settings", async () => {
    const analyzer = vi.fn<ProviderAnalyzer>(async () =>
      parseModelAnalysisWire(validWireAnalysis()),
    );
    const request = AnalyzeRequestSchema.parse({
      provider: "kimi",
      model: "kimi-k3",
      credentialMode: "session",
      kimiRegion: "global",
      outputs: { ankiCards: true },
      chunks: sourceChunks,
    });

    await analyzeWithSelectedProvider(
      request,
      { KIMI_API_KEY: "deployment-key", KIMI_REGION: "invalid" },
      analyzersUsing(analyzer),
      "temporary-kimi-key",
    );

    expect(analyzer).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "temporary-kimi-key",
        baseUrl: "https://api.moonshot.ai/v1",
      }),
    );
  });

  it("fails closed when KIMI_REGION is invalid", async () => {
    const analyzer = vi.fn<ProviderAnalyzer>(async () =>
      parseModelAnalysisWire(validWireAnalysis()),
    );
    const environment = {
      KIMI_API_KEY: "fake-kimi-key",
      KIMI_REGION: "glboal",
    };
    const catalog = getPublicProviderCatalog(environment);
    const kimi = catalog.providers.find((provider) => provider.id === "kimi");
    const request = AnalyzeRequestSchema.parse({
      provider: "kimi",
      model: "kimi-k3",
      credentialMode: "deployment",
      outputs: { ankiCards: true },
      chunks: sourceChunks,
    });

    expect(kimi?.configured).toBe(false);
    await expect(
      analyzeWithSelectedProvider(
        request,
        environment,
        analyzersUsing(analyzer),
      ),
    ).rejects.toMatchObject({
      code: "provider_not_configured",
      retryable: false,
    });
    expect(analyzer).not.toHaveBeenCalled();
  });
});

describe("DeepSeek and Kimi Chat Completions adapters", () => {
  it("uses a missing/new format example when existing notes are absent", () => {
    const input = buildAnalysisInput([sourceChunks[0]!], { ankiCards: false });

    expect(input).toContain('"status":"missing"');
    expect(input).toContain('"changeType":"new"');
    expect(input).not.toContain("use-a-supplied-notes-chunk-id");
    expect(input).not.toContain('"status":"covered"');
  });

  it("repairs only bounded DeepSeek JSON-mode drift without another request", async () => {
    const content = `\`\`\`json\n${JSON.stringify({
      analysis: repairableDeepSeekAnalysis(),
    })}\n\`\`\``;
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(completionEnvelope(content)),
    );

    const result = await analyzeWithChatCompletions({
      provider: "deepseek",
      apiKey: "fake-deepseek-key",
      baseUrl: "https://api.deepseek.example",
      model: "deepseek-v4-flash",
      chunks: sourceChunks,
      outputs: { ankiCards: true },
      fetchImpl: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.assessments[0]).toMatchObject({
      importance: "core",
      status: "covered",
    });
    expect(result.assessments[0]).not.toHaveProperty("suggestedPatch");
    expect(result.enhancedNotes.overview).toContain("### Orientation");
    expect(result.enhancedNotes.sections[0]).toMatchObject({
      changeType: "preserved",
      markdown:
        "### Spacing mechanism\n\nSpace reviews over time.\n\n```text\nnot a heading\n```",
      evidenceRefs: [
        {
          chunkId: "slides:p0001:c01",
          relevance: "The slide defines spacing.",
        },
        {
          chunkId: "notes:p0001:c01",
          relevance: "The notes preserve the definition.",
        },
      ],
    });
    expect(result.ankiCards[0]?.evidenceRefs).toEqual(
      result.assessments[0]?.evidenceRefs,
    );
    expect(
      validateModelAnalysisAgainstChunks(result, sourceChunks, {
        ankiCards: true,
      }).analysis,
    ).toEqual(result);
  });

  it.each(["omitted", "null"] as const)(
    "canonicalizes %s Anki output only when cards were disabled",
    async (variant) => {
      const withoutCards: Record<string, unknown> = {
        ...validWireAnalysis(),
      };
      delete withoutCards.ankiCards;
      const payload = variant === "null"
        ? { ...withoutCards, ankiCards: null }
        : withoutCards;
      const parsed = parseDeepSeekAnalysisText(JSON.stringify(payload), {
        chunks: sourceChunks,
        outputs: { ankiCards: false },
      });

      expect(parsed.ankiCards).toEqual([]);
    },
  );

  it("does not synthesize requested Anki cards", () => {
    const withoutCards: Record<string, unknown> = {
      ...validWireAnalysis(),
    };
    delete withoutCards.ankiCards;

    expect(() =>
      parseDeepSeekAnalysisText(JSON.stringify(withoutCards), {
        chunks: sourceChunks,
        outputs: { ankiCards: true },
      }),
    ).toThrow();
  });

  it.each(["section", "card"] as const)(
    "keeps unknown %s evidence fail-closed for semantic validation",
    (artifact) => {
      const wire = validWireAnalysis();
      const owner =
        artifact === "section"
          ? wire.enhancedNotes.sections[0]
          : wire.ankiCards[0];
      if (owner === undefined) {
        throw new Error(`The fixture must include an Anki ${artifact}.`);
      }
      owner.evidenceRefs = [
        {
          chunkId: "slides:p9999:c01",
          relevance: "This invented artifact reference must not be hidden.",
        },
      ];

      const parsed = parseDeepSeekAnalysisText(JSON.stringify(wire), {
        chunks: sourceChunks,
        outputs: { ankiCards: true },
      });

      expect(() =>
        validateModelAnalysisAgainstChunks(parsed, sourceChunks, {
          ankiCards: true,
        }),
      ).toThrow();
    },
  );

  it.each([
    ["non-array", 42],
    [
      "extra-key",
      [
        {
          chunkId: "slides:p0001:c01",
          relevance: "The slide defines spacing.",
          extra: "must not be discarded",
        },
      ],
    ],
  ] as const)("rejects %s artifact evidence instead of repairing it", (_label, evidenceRefs) => {
    const wire = validWireAnalysis();
    const section = wire.enhancedNotes.sections[0];
    if (section === undefined) {
      throw new Error("The fixture must include an enhanced-note section.");
    }
    const rawSection = section as unknown as Record<string, unknown>;
    rawSection.evidenceRefs = evidenceRefs;

    expect(() =>
      parseDeepSeekAnalysisText(JSON.stringify(wire), {
        chunks: sourceChunks,
        outputs: { ankiCards: true },
      }),
    ).toThrow();
  });

  it("keeps exact DeepSeek repairs isolated from Kimi", async () => {
    const repairable = `\`\`\`json\n${JSON.stringify({
      analysis: repairableDeepSeekAnalysis(),
    })}\n\`\`\``;
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(completionEnvelope(repairable)),
    );

    await expect(
      analyzeWithChatCompletions({
        provider: "kimi",
        apiKey: "fake-kimi-key",
        baseUrl: "https://api.moonshot.example/v1",
        model: "kimi-k3",
        chunks: sourceChunks,
        outputs: { ankiCards: true },
        fetchImpl: fetchMock,
      }),
    ).rejects.toMatchObject({ code: "provider_invalid_output" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not unwrap a DeepSeek analysis wrapper with extra keys", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(
        completionEnvelope(
          JSON.stringify({
            analysis: repairableDeepSeekAnalysis(),
            metadata: "must remain an unknown key",
          }),
        ),
      ),
    );

    await expect(
      analyzeWithChatCompletions({
        provider: "deepseek",
        apiKey: "fake-deepseek-key",
        baseUrl: "https://api.deepseek.example",
        model: "deepseek-v4-flash",
        chunks: sourceChunks,
        outputs: { ankiCards: true },
        fetchImpl: fetchMock,
      }),
    ).rejects.toMatchObject({ code: "provider_invalid_output" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps unknown DeepSeek assessment evidence fail-closed through server validation", async () => {
    const wire = validWireAnalysis();
    const assessment = wire.assessments[0];
    if (assessment === undefined) {
      throw new Error("The fixture must include an assessment.");
    }
    assessment.evidenceRefs = [
      {
        chunkId: "slides:p9999:c01",
        relevance: "This unknown trust anchor must not be repaired away.",
      },
    ];
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(completionEnvelope(JSON.stringify(wire))),
    );
    const deepSeekAnalyzer: ProviderAnalyzer = ({
      apiKey,
      model,
      chunks,
      outputs,
      outputLanguage,
    }) =>
      analyzeWithChatCompletions({
        provider: "deepseek",
        apiKey,
        baseUrl: "https://api.deepseek.example",
        model,
        chunks,
        outputs,
        outputLanguage,
        fetchImpl: fetchMock,
      });
    const request = AnalyzeRequestSchema.parse({
      provider: "deepseek",
      model: "deepseek-v4-flash",
      credentialMode: "deployment",
      outputs: { ankiCards: true },
      chunks: sourceChunks,
    });

    await expect(
      analyzeWithSelectedProvider(
        request,
        { DEEPSEEK_API_KEY: "fake-deepseek-key" },
        analyzersUsing(deepSeekAnalyzer),
      ),
    ).rejects.toMatchObject({ code: "provider_invalid_output" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects mixed-status sections instead of guessing a change type", async () => {
    const covered = validWireAnalysis().assessments[0];
    if (covered === undefined) {
      throw new Error("The fixture must include a covered assessment.");
    }
    const mixed = {
      summary: "Two concepts need different treatment.",
      assessments: [
        covered,
        {
          id: "retrieval",
          title: "Retrieval",
          importance: "core",
          status: "missing",
          explanation: "Retrieval is absent from the notes.",
          evidenceRefs: [
            {
              chunkId: "transcript:p0001:c01",
              relevance: "The transcript explains retrieval.",
            },
          ],
          suggestedPatch: "Add retrieval practice.",
        },
      ],
      enhancedNotes: {
        title: "Study guide",
        overview: "Spacing and retrieval support durable learning.",
        sections: [
          {
            id: "section-mixed",
            heading: "Study methods",
            learningObjective: "Understand spacing and retrieval.",
            changeType: "preserved",
            markdown: "Spacing and retrieval should be practiced deliberately.",
            assessmentIds: ["spacing", "retrieval"],
            evidenceRefs: [],
          },
        ],
      },
      ankiCards: [],
    };
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(completionEnvelope(JSON.stringify(mixed))),
    );

    await expect(
      analyzeWithChatCompletions({
        provider: "deepseek",
        apiKey: "fake-deepseek-key",
        baseUrl: "https://api.deepseek.example",
        model: "deepseek-v4-flash",
        chunks: sourceChunks,
        outputs: { ankiCards: false },
        fetchImpl: fetchMock,
      }),
    ).rejects.toMatchObject({ code: "provider_invalid_output" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("sends the documented DeepSeek JSON-mode request shape", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(completionEnvelope()),
    );

    await analyzeWithChatCompletions({
      provider: "deepseek",
      apiKey: "fake-deepseek-key",
      baseUrl: "https://api.deepseek.example",
      model: "deepseek-v4-flash",
      chunks: sourceChunks,
      outputLanguage: "zh-CN",
      fetchImpl: fetchMock,
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(url).toBe("https://api.deepseek.example/chat/completions");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer fake-deepseek-key",
    );
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(body).toMatchObject({
      model: "deepseek-v4-flash",
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      max_tokens: 8_000,
      stream: false,
    });
    expect(body).not.toHaveProperty("max_completion_tokens");
    expect(JSON.stringify(body.messages)).toContain("Format example only");
    expect(JSON.stringify(body.messages)).toContain("slides:p0001:c01");
    expect(JSON.stringify(body.messages)).toContain(
      "Simplified Chinese (zh-CN)",
    );
    expect(JSON.stringify(body.messages)).toContain("简要说明整体完整性情况");
    expect(JSON.stringify(body.messages)).toContain(
      "Preserve machine-controlled content exactly",
    );
  });

  it("sends Kimi strict JSON Schema and completion-token fields", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(completionEnvelope()),
    );

    await analyzeWithChatCompletions({
      provider: "kimi",
      apiKey: "fake-kimi-key",
      baseUrl: "https://api.moonshot.example/v1",
      model: "kimi-k3",
      chunks: sourceChunks,
      fetchImpl: fetchMock,
    });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(url).toBe("https://api.moonshot.example/v1/chat/completions");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer fake-kimi-key",
    );
    expect(body).toMatchObject({
      model: "kimi-k3",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lectureweaver_analysis",
          strict: true,
          schema: { type: "object", additionalProperties: false },
        },
      },
      max_completion_tokens: 8_000,
      stream: false,
    });
    expect(body).not.toHaveProperty("thinking");
    expect(body).not.toHaveProperty("max_tokens");
  });

  it("maps timeouts without exposing request credentials", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const pending = analyzeWithChatCompletions({
      provider: "deepseek",
      apiKey: "fake-timeout-secret",
      baseUrl: "https://api.deepseek.example",
      model: "deepseek-v4-flash",
      chunks: sourceChunks,
      fetchImpl: fetchMock,
    });
    const assertion = expect(pending).rejects.toMatchObject({
      code: "provider_timeout",
      status: 504,
      retryable: true,
    });

    await vi.advanceTimersByTimeAsync(ANALYSIS_PROVIDER_TIMEOUT_MS);
    await assertion;
    await expect(pending).rejects.not.toHaveProperty(
      "message",
      expect.stringContaining("fake-timeout-secret"),
    );
  });

  it("aborts a stalled successful response body at the provider deadline", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      capturedSignal = init?.signal ?? undefined;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener(
            "abort",
            () => controller.error(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        },
      });

      return new Response(body, { status: 200 });
    });
    const pending = analyzeWithChatCompletions({
      provider: "deepseek",
      apiKey: "fake-body-stall-secret",
      baseUrl: "https://api.deepseek.example",
      model: "deepseek-v4-flash",
      chunks: sourceChunks,
      fetchImpl: fetchMock,
    });
    const assertion = expect(pending).rejects.toMatchObject({
      code: "provider_timeout",
      status: 504,
      retryable: true,
    });

    await vi.advanceTimersByTimeAsync(ANALYSIS_PROVIDER_TIMEOUT_MS - 1);
    expect(capturedSignal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(capturedSignal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("maps a structural AbortError without relying on DOMException", async () => {
    const structuralAbort = Object.assign(new Error("request aborted"), {
      name: "AbortError",
    });
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw structuralAbort;
    });

    await expect(
      analyzeWithChatCompletions({
        provider: "kimi",
        apiKey: "fake-kimi-key",
        baseUrl: "https://api.moonshot.example/v1",
        model: "kimi-k3",
        chunks: sourceChunks,
        fetchImpl: fetchMock,
      }),
    ).rejects.toMatchObject({
      code: "provider_timeout",
      status: 504,
      retryable: true,
    });
  });

  it("maps upstream status and malformed bodies to safe typed errors", async () => {
    const rateLimitedFetch = vi.fn<typeof fetch>(async () =>
      new Response("private upstream account detail", { status: 429 }),
    );
    const malformedFetch = vi.fn<typeof fetch>(async () =>
      new Response("not-json", { status: 200 }),
    );
    const options = {
      provider: "deepseek" as const,
      apiKey: "fake-provider-key",
      baseUrl: "https://api.deepseek.example",
      model: "deepseek-v4-flash",
      chunks: sourceChunks,
    };

    await expect(
      analyzeWithChatCompletions({ ...options, fetchImpl: rateLimitedFetch }),
    ).rejects.toMatchObject({ code: "rate_limited", status: 429, retryable: true });
    await expect(
      analyzeWithChatCompletions({ ...options, fetchImpl: malformedFetch }),
    ).rejects.toMatchObject({
      code: "provider_invalid_output",
      status: 502,
      retryable: true,
    });
  });

  it.each([
    ["length", "provider_invalid_output", true],
    ["content_filter", "provider_refusal", false],
    ["insufficient_system_resource", "provider_error", true],
  ] as const)(
    "maps %s finish reasons to %s",
    async (finishReason, code, retryable) => {
      const fetchMock = vi.fn<typeof fetch>(async () =>
        Response.json(completionEnvelope("", finishReason)),
      );

      await expect(
        analyzeWithChatCompletions({
          provider: "deepseek",
          apiKey: "fake-provider-key",
          baseUrl: "https://api.deepseek.example",
          model: "deepseek-v4-flash",
          chunks: sourceChunks,
          fetchImpl: fetchMock,
        }),
      ).rejects.toMatchObject({ code, retryable });
    },
  );

  it("distinguishes Kimi content filtering and exhausted quota", async () => {
    const contentFilterFetch = vi.fn<typeof fetch>(async () =>
      Response.json(
        { error: { type: "content_filter", message: "private detail" } },
        { status: 400 },
      ),
    );
    const quotaFetch = vi.fn<typeof fetch>(async () =>
      Response.json(
        {
          error: {
            type: "exceeded_current_quota_error",
            message: "private account detail",
          },
        },
        { status: 429 },
      ),
    );
    const options = {
      provider: "kimi" as const,
      apiKey: "fake-kimi-key",
      baseUrl: "https://api.moonshot.example/v1",
      model: "kimi-k3",
      chunks: sourceChunks,
    };

    await expect(
      analyzeWithChatCompletions({
        ...options,
        fetchImpl: contentFilterFetch,
      }),
    ).rejects.toMatchObject({
      code: "provider_refusal",
      retryable: false,
    });
    await expect(
      analyzeWithChatCompletions({ ...options, fetchImpl: quotaFetch }),
    ).rejects.toMatchObject({
      code: "provider_balance",
      retryable: false,
    });
  });

  it("rejects empty and oversized successful provider responses", async () => {
    const emptyFetch = vi.fn<typeof fetch>(async () =>
      Response.json(completionEnvelope("")),
    );
    const oversizedFetch = vi.fn<typeof fetch>(async () =>
      new Response("x".repeat(250_001), { status: 200 }),
    );
    const invalidEncodingFetch = vi.fn<typeof fetch>(async () =>
      new Response(new Uint8Array([0xff, 0xfe]), { status: 200 }),
    );
    const options = {
      provider: "deepseek" as const,
      apiKey: "fake-provider-key",
      baseUrl: "https://api.deepseek.example",
      model: "deepseek-v4-flash",
      chunks: sourceChunks,
    };

    await expect(
      analyzeWithChatCompletions({ ...options, fetchImpl: emptyFetch }),
    ).rejects.toMatchObject({ code: "provider_invalid_output" });
    await expect(
      analyzeWithChatCompletions({ ...options, fetchImpl: oversizedFetch }),
    ).rejects.toMatchObject({ code: "provider_invalid_output" });
    await expect(
      analyzeWithChatCompletions({
        ...options,
        fetchImpl: invalidEncodingFetch,
      }),
    ).rejects.toMatchObject({ code: "provider_invalid_output" });
  });
});
