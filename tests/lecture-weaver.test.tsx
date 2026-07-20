import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SVGProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PublicProviderCatalogSchema,
  SourceChunkListSchema,
} from "@/domain";
import {
  buildAnalysisResult,
  type AnalysisResult,
} from "@/lib/analysis";
import {
  LiveAnalysisError,
  requestLiveAnalysis,
} from "@/lib/ai/client";
import type { DemoAnalysisResult } from "@/lib/demo";
import {
  DemoFingerprintMismatchError,
  loadDemoFiles,
  recoverDemoPdfExtraction,
  runFixtureAnalysis,
} from "@/lib/demo";
import {
  processSourceFiles,
  SourceProcessingError,
} from "@/lib/extraction";
import type { ProcessedSources, SourceFiles } from "@/lib/extraction";

import { LectureWeaver } from "@/components/lecture-weaver";

import { buildTestAnalysis } from "./analysis-fixtures";

vi.mock("lucide-react", () => {
  const Icon = (props: SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    AlertTriangle: Icon,
    ArrowRight: Icon,
    AudioLines: Icon,
    BookOpen: Icon,
    Brain: Icon,
    Check: Icon,
    ChevronRight: Icon,
    CircleCheck: Icon,
    Clipboard: Icon,
    Download: Icon,
    Eye: Icon,
    FileText: Icon,
    Headphones: Icon,
    LoaderCircle: Icon,
    Lock: Icon,
    ListChecks: Icon,
    NotebookPen: Icon,
    Presentation: Icon,
    RotateCcw: Icon,
    ScanText: Icon,
    ShieldCheck: Icon,
    Sparkles: Icon,
    Upload: Icon,
    Volume2: Icon,
    X: Icon,
  };
});

vi.mock("@/lib/demo", async () => {
  const actual = await vi.importActual<typeof import("@/lib/demo")>("@/lib/demo");
  return {
    ...actual,
    loadDemoFiles: vi.fn(),
    recoverDemoPdfExtraction: vi.fn(),
    runFixtureAnalysis: vi.fn(),
  };
});

vi.mock("@/lib/extraction", async () => {
  const actual = await vi.importActual<typeof import("@/lib/extraction")>(
    "@/lib/extraction",
  );
  return {
    ...actual,
    processSourceFiles: vi.fn(),
  };
});

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>(
    "@/lib/ai/client",
  );
  return {
    ...actual,
    requestLiveAnalysis: vi.fn(),
  };
});

const chunks = SourceChunkListSchema.parse([
  {
    id: "slides:p0001:c01",
    sourceType: "slides",
    sourceName: "sample.pdf",
    locator: "Page 1",
    text: "Trusted slide excerpt about choosing a learning strategy.",
  },
  {
    id: "transcript:p0002-p0003:c01",
    sourceType: "transcript",
    sourceName: "sample.txt",
    locator: "Paragraphs 2–3",
    text: "Trusted transcript excerpt: attempt, feedback, correction, then retry.",
  },
  {
    id: "notes:p0004:c01",
    sourceType: "notes",
    sourceName: "sample.md",
    locator: "Paragraph 4",
    headingPath: ["Study methods", "Current notes"],
    text: "The existing notes say familiarity proves mastery.",
  },
]);

const modelAnalysis = buildTestAnalysis(
  [
    {
      id: "retrieval",
      title: "Retrieval practice",
      importance: "core",
      status: "covered",
      explanation: "The notes preserve the source explanation.",
      evidenceRefs: [
        {
          chunkId: "slides:p0001:c01",
          relevance: "The slide supplies the trusted definition.",
        },
        {
          chunkId: "notes:p0004:c01",
          relevance: "The notes contain the same concept.",
        },
      ],
    },
    {
      id: "interleaving",
      title: "Interleaving and discrimination",
      importance: "core",
      status: "partial",
      explanation: "The notes mention mixing but omit diagnostic discrimination.",
      evidenceRefs: [
        {
          chunkId: "slides:p0001:c01",
          relevance: "The slide explains strategy selection.",
        },
        {
          chunkId: "notes:p0004:c01",
          relevance: "The notes contain only the partial claim.",
        },
      ],
      suggestedPatch:
        "Interleaving builds discrimination by requiring learners to choose among strategies.",
    },
    {
      id: "feedback",
      title: "Feedback correction loop",
      importance: "core",
      status: "missing",
      explanation: "The notes omit the attempt–feedback–correction–retry loop.",
      evidenceRefs: [
        {
          chunkId: "transcript:p0002-p0003:c01",
          relevance: "The transcript supplies the correction loop and its order.",
        },
      ],
      suggestedPatch: "Use the loop: attempt → feedback → correction → retry.",
    },
    {
      id: "rereading",
      title: "Rereading fluency versus mastery",
      importance: "core",
      status: "contradiction",
      explanation: "The notes mistake familiarity for durable mastery.",
      evidenceRefs: [
        {
          chunkId: "slides:p0001:c01",
          relevance: "The slide warns against familiarity as evidence.",
        },
        {
          chunkId: "notes:p0004:c01",
          relevance: "The notes make the opposing claim.",
        },
      ],
      suggestedPatch: "Familiarity from rereading is not evidence of mastery.",
    },
  ],
  {
    summary:
      "The notes preserve one concept, partially cover another, omit a feedback loop, and contradict the source on rereading.",
    includeAnki: true,
  },
);

const processed: ProcessedSources = {
  chunks,
  totalCharacters: chunks.reduce((total, chunk) => total + chunk.text.length, 0),
  counts: { slides: 1, transcript: 1, notes: 1 },
};

const result: DemoAnalysisResult = {
  ...buildAnalysisResult(
    modelAnalysis,
    chunks,
    { kind: "demo" },
    { ankiCards: true },
  ),
  fingerprints: {
    slides: "a".repeat(64),
    transcript: "b".repeat(64),
    notes: "c".repeat(64),
  },
};

const liveResult: AnalysisResult = buildAnalysisResult(
  modelAnalysis,
  chunks,
  {
    kind: "live",
    provider: "deepseek",
    providerLabel: "DeepSeek",
    model: "deepseek-v4-pro",
  },
  { ankiCards: true },
);

const noAnkiAnalysis = buildTestAnalysis(modelAnalysis.assessments, {
  summary: modelAnalysis.summary,
  includeAnki: false,
});
const noAnkiLiveResult: AnalysisResult = buildAnalysisResult(
  noAnkiAnalysis,
  chunks,
  {
    kind: "live",
    provider: "deepseek",
    providerLabel: "DeepSeek",
    model: "deepseek-v4-pro",
  },
  { ankiCards: false },
);

const configuredProviders = PublicProviderCatalogSchema.parse({
  providers: [
    {
      id: "deepseek",
      label: "DeepSeek",
      description: "Mocked live provider.",
      configured: true,
      defaultModel: "deepseek-v4-pro",
      models: [
        {
          id: "deepseek-v4-pro",
          label: "DeepSeek V4 Pro",
          description: "Mocked live model.",
        },
      ],
    },
  ],
});
const configuredDeepSeek = configuredProviders.providers[0];
if (configuredDeepSeek === undefined) {
  throw new Error("The UI test catalog must include DeepSeek.");
}

const multiProviderCatalog = PublicProviderCatalogSchema.parse({
  providers: [
    configuredDeepSeek,
    {
      id: "kimi",
      label: "Kimi",
      description: "Mocked alternate provider.",
      configured: true,
      defaultModel: "kimi-k3",
      models: [
        {
          id: "kimi-k3",
          label: "Kimi K3",
          description: "Mocked alternate model.",
        },
      ],
    },
  ],
});

const temporaryKeyCatalog = PublicProviderCatalogSchema.parse({
  providers: [
    {
      id: "deepseek",
      label: "DeepSeek",
      description: "Temporary-key DeepSeek provider.",
      configured: false,
      defaultModel: "deepseek-v4-pro",
      models: [
        {
          id: "deepseek-v4-pro",
          label: "DeepSeek V4 Pro",
          description: "Mocked live model.",
        },
      ],
    },
    {
      id: "kimi",
      label: "Kimi",
      description: "Temporary-key Kimi provider.",
      configured: false,
      defaultModel: "kimi-k3",
      models: [
        {
          id: "kimi-k3",
          label: "Kimi K3",
          description: "Mocked alternate model.",
        },
      ],
    },
    {
      id: "openai",
      label: "OpenAI",
      description: "Temporary-key OpenAI provider.",
      configured: false,
      defaultModel: "gpt-5.6",
      models: [
        {
          id: "gpt-5.6",
          label: "GPT-5.6 Sol",
          description: "Mocked OpenAI model.",
        },
      ],
    },
  ],
});

const kimiLiveResult: AnalysisResult = {
  ...liveResult,
  origin: {
    kind: "live",
    provider: "kimi",
    providerLabel: "Kimi",
    model: "kimi-k3",
  },
};

const mockLoadDemoFiles = vi.mocked(loadDemoFiles);
const mockRecoverDemoPdfExtraction = vi.mocked(recoverDemoPdfExtraction);
const mockProcessSourceFiles = vi.mocked(processSourceFiles);
const mockRunFixtureAnalysis = vi.mocked(runFixtureAnalysis);
const mockRequestLiveAnalysis = vi.mocked(requestLiveAnalysis);

function sourceFiles(slidesName = "sample.pdf"): SourceFiles {
  return {
    slides: new File(["%PDF-synthetic"], slidesName, {
      type: "application/pdf",
    }),
    transcript: new File(["Synthetic transcript"], "sample.txt", {
      type: "text/plain",
    }),
    notes: new File(["# Synthetic notes"], "sample.md", {
      type: "text/markdown",
    }),
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

async function renderReady(): Promise<ReturnType<typeof userEvent.setup>> {
  const user = userEvent.setup();
  const files = sourceFiles();
  mockLoadDemoFiles.mockResolvedValue(files);
  mockProcessSourceFiles.mockResolvedValue(processed);
  mockRunFixtureAnalysis.mockResolvedValue(result);

  render(<LectureWeaver />);
  await user.click(
    screen.getByRole("button", { name: "Try the sample lecture" }),
  );
  await screen.findByRole("heading", { name: "Needs a careful pass" });
  return user;
}

beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(window, "requestAnimationFrame", {
    configurable: true,
    value: (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    },
  });
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:lectureweaver-test"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LectureWeaver client workflow", () => {
  it("switches the interface among English, Chinese, Japanese, and Korean", async () => {
    const user = userEvent.setup();

    render(<LectureWeaver />);

    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(
      screen.getByRole("heading", {
        name: "Turn lectures into notes you can study.",
      }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Language: 简体中文" }),
    );

    expect(document.documentElement).toHaveAttribute("lang", "zh-CN");
    expect(
      screen.getByRole("heading", {
        name: /把课堂内容变成真正能用来\s+学习的笔记。/,
      }),
    ).toBeVisible();
    expect(screen.getByText("API 密钥应该填在哪里？")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "语言: 日本語" }),
    );

    expect(document.documentElement).toHaveAttribute("lang", "ja");
    expect(
      screen.getByRole("heading", {
        name: /講義を、本当に\s+学べるノートへ。/,
      }),
    ).toBeVisible();
    expect(screen.getByText("API キーはどこに設定しますか？")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "言語: 한국어" }),
    );

    expect(document.documentElement).toHaveAttribute("lang", "ko");
    expect(
      screen.getByRole("heading", {
        name: /강의를 실제로\s+공부할 수 있는 노트로./,
      }),
    ).toBeVisible();
    expect(screen.getByText("API 키는 어디에 설정하나요?")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "언어: English" }),
    );

    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(
      screen.getByRole("heading", {
        name: "Turn lectures into notes you can study.",
      }),
    ).toBeVisible();
  });

  it("keeps the study-pack heading semantically inside its labelled container", () => {
    render(<LectureWeaver providers={configuredProviders} />);

    const heading = screen.getByRole("heading", {
      name: "Study pack outputs",
    });
    const container = heading.closest("section");

    expect(container).not.toBeNull();
    expect(heading).toHaveAttribute("id", "study-pack-outputs-title");
    expect(container).toHaveAttribute(
      "aria-labelledby",
      "study-pack-outputs-title",
    );
    expect(
      within(container as HTMLElement).getByLabelText("Output language"),
    ).toBeVisible();
    expect(
      within(container as HTMLElement).getByText("Enhanced notes"),
    ).toBeVisible();
  });

  it("keeps the live-analysis action visible and localizes why it is unavailable", async () => {
    const user = userEvent.setup();

    render(<LectureWeaver providers={temporaryKeyCatalog} />);

    const englishAction = screen.getByRole("button", {
      name: "Extract and analyze with DeepSeek",
    });
    expect(englishAction).toBeDisabled();
    expect(englishAction).toHaveAccessibleDescription(
      "Enter a valid temporary DeepSeek key above, or configure its deployment key.",
    );

    await user.click(
      screen.getByRole("button", { name: "Language: 简体中文" }),
    );

    const chineseAction = screen.getByRole("button", {
      name: "提取并使用 DeepSeek 分析",
    });
    expect(chineseAction).toBeDisabled();
    expect(chineseAction).toHaveAccessibleDescription(
      "请在上方输入有效的临时 DeepSeek 密钥，或为该服务商配置部署密钥。",
    );
  });

  it("enables live analysis after either lecture material or a transcript is ready", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    mockProcessSourceFiles.mockResolvedValue(processed);

    render(<LectureWeaver providers={configuredProviders} />);

    const liveAnalysisButton = screen.getByRole("button", {
      name: "Extract and analyze with DeepSeek",
    });
    expect(liveAnalysisButton).toBeDisabled();
    expect(liveAnalysisButton).toHaveAccessibleDescription(
      /Only one is required/i,
    );

    await user.upload(
      screen.getByLabelText("Choose lecture PDF file"),
      selectedFiles.slides,
    );
    expect(liveAnalysisButton).toBeEnabled();
    expect(liveAnalysisButton).toHaveAccessibleDescription(
      /DeepSeek is ready/i,
    );

    await user.click(
      screen.getByRole("button", { name: "Build local source map" }),
    );
    await waitFor(() =>
      expect(mockProcessSourceFiles).toHaveBeenCalledWith({
        slides: selectedFiles.slides,
      }),
    );
  });

  it("accepts a transcript as the only required lecture source", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();

    render(<LectureWeaver providers={configuredProviders} />);

    const liveAnalysisButton = screen.getByRole("button", {
      name: "Extract and analyze with DeepSeek",
    });

    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    expect(liveAnalysisButton).toBeEnabled();
    expect(liveAnalysisButton).toHaveAccessibleDescription(
      /DeepSeek is ready/i,
    );
  });

  it("keeps notes-only input disabled until a lecture source is added", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();

    render(<LectureWeaver providers={configuredProviders} />);

    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );

    expect(
      screen.getByRole("button", { name: "Build local source map" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Extract and analyze with DeepSeek",
      }),
    ).toHaveAccessibleDescription(/Only one is required/i);
  });

  it("uses the Chinese interface language for the next live analysis by default", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRequestLiveAnalysis.mockResolvedValue(liveResult);

    render(<LectureWeaver providers={configuredProviders} />);

    const englishLanguageSelect = screen.getByLabelText("Output language");
    expect(englishLanguageSelect).toHaveValue("follow-interface");
    expect(
      within(englishLanguageSelect).getByRole("option", {
        name: "Follow interface (English)",
      }),
    ).toHaveProperty("selected", true);

    await user.upload(
      screen.getByLabelText("Choose lecture PDF file"),
      selectedFiles.slides,
    );
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", { name: "Language: 简体中文" }),
    );

    const chineseLanguageSelect = screen.getByLabelText("输出语言");
    expect(chineseLanguageSelect).toHaveValue("follow-interface");
    expect(
      within(chineseLanguageSelect).getByRole("option", {
        name: "跟随界面（简体中文）",
      }),
    ).toHaveProperty("selected", true);

    await user.click(
      screen.getByRole("button", {
        name: "提取并使用 DeepSeek 分析",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "需要仔细复查" }),
    ).toBeVisible();
    expect(mockRequestLiveAnalysis).toHaveBeenCalledWith(
      processed,
      { provider: "deepseek", model: "deepseek-v4-pro" },
      { ankiCards: true },
      { outputLanguage: "zh-CN" },
    );
  });

  it("keeps an in-flight demo active and localizes the completed study pack", async () => {
    const user = userEvent.setup();
    const files = sourceFiles();
    const processing = deferred<ProcessedSources>();
    mockLoadDemoFiles.mockResolvedValue(files);
    mockProcessSourceFiles.mockReturnValue(processing.promise);
    mockRunFixtureAnalysis.mockResolvedValue(result);

    render(<LectureWeaver />);

    const headerDemoButton = screen.getByRole("button", { name: "Try demo" });
    await user.click(headerDemoButton);
    expect(headerDemoButton).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "Language: 简体中文" }),
    );

    expect(document.documentElement).toHaveAttribute("lang", "zh-CN");
    expect(
      screen.getByRole("button", { name: "体验演示" }),
    ).toBeDisabled();

    await act(async () => {
      processing.resolve(processed);
      await processing.promise;
    });

    expect(
      await screen.findByRole("heading", { name: "需要仔细复查" }),
    ).toBeVisible();
    expect(screen.getByText("示例指纹已验证")).toBeVisible();
    expect(screen.getByText("已审查 4 个概念")).toBeVisible();
    expect(screen.getByRole("heading", { name: "增强笔记" })).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "增强笔记目录" }),
    ).toBeVisible();

    expect(screen.getByRole("button", { name: "增强笔记" })).toBeVisible();
    expect(screen.getByRole("button", { name: "审查记录" })).toBeVisible();
    expect(screen.getByRole("button", { name: "仅看改动" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Anki 卡片 · 4" })).toBeVisible();
    expect(screen.getByRole("button", { name: "音频指南" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "审查记录" }));
    expect(screen.getByRole("heading", { name: "补齐重要缺口。" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "查看证据" }).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "音频指南" }));
    expect(
      screen.getByRole("heading", { name: "音频学习指南" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "OpenAI 音频不可用" }),
    ).toBeDisabled();
    expect(mockRequestLiveAnalysis).not.toHaveBeenCalled();
  });

  it("runs the one-click demo through an honest loading state to validated results", async () => {
    const user = userEvent.setup();
    const files = sourceFiles();
    const processing = deferred<ProcessedSources>();
    mockLoadDemoFiles.mockResolvedValue(files);
    mockProcessSourceFiles.mockReturnValue(processing.promise);
    mockRunFixtureAnalysis.mockResolvedValue(result);

    render(<LectureWeaver providers={configuredProviders} />);

    expect(
      screen.getByRole("button", { name: "Build local source map" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Choose lecture PDF file")).toHaveAttribute(
      "accept",
      expect.stringContaining(".pdf"),
    );
    expect(screen.getByLabelText("Choose transcript file")).toBeEnabled();
    expect(screen.getByLabelText("Choose existing notes file")).toBeEnabled();
    await user.type(
      screen.getByLabelText("Temporary DeepSeek API key"),
      "temporary-demo-guard-key-123456",
    );

    await user.click(
      screen.getByRole("button", { name: "Try the sample lecture" }),
    );

    await waitFor(() => expect(mockProcessSourceFiles).toHaveBeenCalledWith(files));
    expect(screen.getByText("Extracting lecture and paragraph structure…")).toBeVisible();
    expect(
      screen.getByText("Extracting lecture and paragraph structure…").closest("section"),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("button", { name: "Build local source map" }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "Language: 简体中文" }),
    );
    expect(screen.getByText("正在提取讲义和段落结构…")).toBeVisible();
    expect(
      screen.queryByText("Extracting lecture and paragraph structure…"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "语言: English" }));

    await act(async () => {
      processing.resolve(processed);
      await processing.promise;
    });

    expect(
      await screen.findByRole("heading", { name: "Needs a careful pass" }),
    ).toBeVisible();
    expect(mockRunFixtureAnalysis).toHaveBeenCalledWith(processed, {
      ankiCards: true,
    });
    expect(screen.getByText("38")).toBeVisible();
    expect(screen.getByText("4 concepts audited")).toBeVisible();
    expect(screen.getByText("Sample fingerprint verified")).toBeVisible();
    expect(screen.getAllByText("sample.pdf").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Enhanced notes" })).toBeVisible();
    expect(
      screen.getByRole("navigation", {
        name: "Enhanced notes table of contents",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Retrieval practice/ }),
    ).toHaveAttribute("href", "#enhanced-section-1");
    expect(screen.getByRole("button", { name: "Anki cards · 4" })).toBeVisible();
    expect(mockRequestLiveAnalysis).not.toHaveBeenCalled();
  });

  it("filters the actionable review queue without hard-coded result cards", async () => {
    const user = await renderReady();
    await user.click(screen.getByRole("button", { name: "Audit trail" }));

    expect(
      screen.getByRole("heading", { name: "Feedback correction loop" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Interleaving and discrimination" }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Rereading fluency versus mastery" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Missing" }));
    expect(
      screen.getByRole("heading", { name: "Feedback correction loop" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Interleaving and discrimination" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Missing" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Contradictions" }));
    expect(
      screen.getByRole("heading", { name: "Rereading fluency versus mastery" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Feedback correction loop" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Partial" }));
    expect(
      screen.getByRole("heading", { name: "Interleaving and discrimination" }),
    ).toBeVisible();
  });

  it("opens trusted evidence in an accessible dialog and restores focus", async () => {
    const user = await renderReady();
    await user.click(screen.getByRole("button", { name: "Audit trail" }));
    const issueHeading = screen.getByRole("heading", {
      name: "Feedback correction loop",
    });
    const issueCard = issueHeading.closest("article");
    expect(issueCard).not.toBeNull();
    const openButton = within(issueCard as HTMLElement).getByRole("button", {
      name: "Inspect evidence",
    });

    openButton.focus();
    await user.click(openButton);

    const dialog = screen.getByRole("dialog", {
      name: "Feedback correction loop",
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      within(dialog).getByRole("button", { name: "Close evidence panel" }),
    ).toHaveFocus();
    expect(within(dialog).getByText("sample.txt")).toBeVisible();
    expect(within(dialog).getByText("Paragraphs 2–3")).toBeVisible();
    expect(
      within(dialog).getByText(/Trusted transcript excerpt: attempt, feedback/),
    ).toBeVisible();
    expect(
      within(dialog).getByText(/supplies the correction loop and its order/),
    ).toBeVisible();

    await user.tab();
    expect(
      within(dialog).getByRole("button", { name: "Close evidence panel" }),
    ).toHaveFocus();
    await user.tab({ shift: true });
    expect(
      within(dialog).getByRole("button", { name: "Close evidence panel" }),
    ).toHaveFocus();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(openButton).toHaveFocus();
  });

  it("retranslates an open evidence drawer when the interface language changes", async () => {
    const user = await renderReady();
    await user.click(screen.getByRole("button", { name: "Audit trail" }));
    const issueCard = screen
      .getByRole("heading", { name: "Feedback correction loop" })
      .closest("article");
    expect(issueCard).not.toBeNull();

    await user.click(
      within(issueCard as HTMLElement).getByRole("button", {
        name: "Inspect evidence",
      }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Feedback correction loop",
    });
    expect(within(dialog).getByText("Audit evidence")).toBeVisible();
    expect(within(dialog).getByText("Missing explanation")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Language: 简体中文" }),
    );

    expect(within(dialog).getByText("审查证据")).toBeVisible();
    expect(within(dialog).getByText("缺少解释")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "关闭证据面板" }),
    ).toBeVisible();
  });

  it("accepts a lecture TXT file through the same source-file pipeline", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    const lectureTextFile = new File(
      ["Retrieval practice improves durable learning."],
      "lecture.txt",
      { type: "text/plain" },
    );
    mockProcessSourceFiles.mockResolvedValue(processed);

    render(<LectureWeaver />);

    const lectureModeGroup = screen.getByRole("group", {
      name: "Choose lecture material type",
    });
    expect(lectureModeGroup).toHaveClass("grid-cols-3");
    await user.click(within(lectureModeGroup).getByRole("button", { name: "TXT file" }));
    await user.upload(
      screen.getByLabelText("Choose lecture TXT file"),
      lectureTextFile,
    );
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", { name: "Build local source map" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Your local source map is ready.",
      }),
    ).toBeVisible();
    expect(mockProcessSourceFiles).toHaveBeenCalledWith({
      slides: lectureTextFile,
      transcript: selectedFiles.transcript,
      notes: selectedFiles.notes,
    });
  });

  it("turns pasted lecture text into a local File before processing", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    mockProcessSourceFiles.mockResolvedValue(processed);

    render(<LectureWeaver />);

    await user.click(
      within(
        screen.getByRole("group", { name: "Choose lecture material type" }),
      ).getByRole("button", { name: "Paste lecture" }),
    );
    const lectureTextarea = screen.getByLabelText("Paste lecture text");
    fireEvent.change(lectureTextarea, {
      target: {
        value: "Spacing study sessions improves long-term retention.",
      },
    });
    expect(await screen.findByText("pasted-lecture.txt")).toBeVisible();
    expect(mockRequestLiveAnalysis).not.toHaveBeenCalled();

    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", { name: "Build local source map" }),
    );

    await screen.findByRole("heading", {
      name: "Your local source map is ready.",
    });
    const processedFiles = mockProcessSourceFiles.mock.calls.at(-1)?.[0];
    expect(processedFiles?.slides).toBeInstanceOf(File);
    expect(processedFiles?.slides.name).toBe("pasted-lecture.txt");
    expect(processedFiles?.slides.type).toBe("text/plain");
    await expect(processedFiles?.slides.text()).resolves.toBe(
      "Spacing study sessions improves long-term retention.",
    );
  });

  it("invalidates an accepted lecture paste and automatically validates the edited text", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    mockProcessSourceFiles.mockResolvedValue(processed);

    render(<LectureWeaver />);

    await user.click(
      within(
        screen.getByRole("group", { name: "Choose lecture material type" }),
      ).getByRole("button", { name: "Paste lecture" }),
    );
    const lectureTextarea = screen.getByLabelText("Paste lecture text");
    fireEvent.change(lectureTextarea, {
      target: { value: "The first pasted lecture draft." },
    });
    expect(await screen.findByText("pasted-lecture.txt")).toBeVisible();

    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    expect(
      screen.getByRole("button", { name: "Build local source map" }),
    ).toBeEnabled();

    fireEvent.change(lectureTextarea, {
      target: {
        value: "The revised lecture explains retrieval and feedback.",
      },
    });
    expect(screen.queryByText("pasted-lecture.txt")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Build local source map" }),
    ).toBeEnabled();
    expect(await screen.findByText("pasted-lecture.txt")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Build local source map" }),
    ).toBeEnabled();
    await user.click(
      screen.getByRole("button", { name: "Build local source map" }),
    );

    await screen.findByRole("heading", {
      name: "Your local source map is ready.",
    });
    const processedFiles = mockProcessSourceFiles.mock.calls.at(-1)?.[0];
    expect(processedFiles?.slides.name).toBe("pasted-lecture.txt");
    await expect(processedFiles?.slides.text()).resolves.toBe(
      "The revised lecture explains retrieval and feedback.",
    );
  });

  it("rejects empty and oversized pasted lecture text before processing", async () => {
    const user = userEvent.setup();
    render(<LectureWeaver />);

    await user.click(
      within(
        screen.getByRole("group", { name: "Choose lecture material type" }),
      ).getByRole("button", { name: "Paste lecture" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Validate lecture text now" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Paste lecture text before continuing.",
    );

    fireEvent.change(screen.getByLabelText("Paste lecture text"), {
      target: { value: "x".repeat(1024 * 1024 + 1) },
    });
    await user.click(
      screen.getByRole("button", { name: "Validate lecture text now" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "pasted-lecture.txt is larger than the 1 MiB lecture text limit.",
    );
    expect(mockProcessSourceFiles).not.toHaveBeenCalled();
  });

  it("clears the accepted lecture source on mode changes and restores PDF mode for the demo", async () => {
    const user = userEvent.setup();
    const files = sourceFiles();
    mockLoadDemoFiles.mockResolvedValue(files);
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRunFixtureAnalysis.mockResolvedValue(result);

    render(<LectureWeaver />);
    const lectureModeGroup = screen.getByRole("group", {
      name: "Choose lecture material type",
    });
    await user.click(within(lectureModeGroup).getByRole("button", { name: "Paste lecture" }));
    fireEvent.change(screen.getByLabelText("Paste lecture text"), {
      target: { value: "A compact lecture outline." },
    });
    await user.click(
      screen.getByRole("button", { name: "Validate lecture text now" }),
    );
    expect(await screen.findByText("pasted-lecture.txt")).toBeVisible();

    await user.click(within(lectureModeGroup).getByRole("button", { name: "TXT file" }));
    expect(screen.queryByText("pasted-lecture.txt")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Build local source map" }),
    ).toBeDisabled();

    await user.click(
      screen.getByRole("button", { name: "Try the sample lecture" }),
    );
    await screen.findByRole("heading", { name: "Needs a careful pass" });
    expect(
      within(lectureModeGroup).getByRole("button", { name: "PDF" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("sample.pdf").length).toBeGreaterThan(0);
  });

  it("shows a local validation error and recovers after replacing the file", async () => {
    const user = userEvent.setup();
    const invalidFiles = sourceFiles("invalid.pdf");
    const replacementPdf = new File(["%PDF-valid"], "replacement.pdf", {
      type: "application/pdf",
    });
    mockProcessSourceFiles
      .mockRejectedValueOnce(
        new SourceProcessingError(
          "invalid_pdf",
          "slides",
          "The selected PDF does not have a valid PDF signature.",
        ),
      )
      .mockResolvedValueOnce(processed);
    mockRunFixtureAnalysis.mockResolvedValue(result);

    render(<LectureWeaver providers={configuredProviders} />);
    await user.upload(screen.getByLabelText("Choose lecture PDF file"), invalidFiles.slides);
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      invalidFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      invalidFiles.notes,
    );
    await user.click(
      screen.getByRole("button", { name: "Build local source map" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "The selected PDF does not have a valid PDF signature.",
    );
    expect(screen.getByText("invalid.pdf")).toBeVisible();

    await user.upload(screen.getByLabelText("Choose lecture PDF file"), replacementPdf);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("replacement.pdf")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Build local source map" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Your local source map is ready.",
      }),
    ).toBeVisible();
    expect(screen.getByText("Local source map ready")).toBeVisible();
    expect(mockRunFixtureAnalysis).not.toHaveBeenCalled();
    expect(mockRequestLiveAnalysis).not.toHaveBeenCalled();
    const retriedFiles = mockProcessSourceFiles.mock.calls.at(-1)?.[0];
    expect(retriedFiles?.slides).toBe(replacementPdf);
  });

  it("offers pasted lecture text after a recoverable PDF extraction failure", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles("image-only.pdf");
    mockProcessSourceFiles
      .mockRejectedValueOnce(
        new SourceProcessingError(
          "empty_source",
          "slides",
          "No usable text was found in the PDF.",
        ),
      )
      .mockResolvedValueOnce(processed);

    render(<LectureWeaver />);
    await user.upload(
      screen.getByLabelText("Choose lecture PDF file"),
      selectedFiles.slides,
    );
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", { name: "Build local source map" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No usable text was found in the PDF.",
    );
    await user.click(
      screen.getByRole("button", { name: "Use lecture text instead" }),
    );
    const lectureTextarea = screen.getByLabelText("Paste lecture text");
    expect(lectureTextarea).toHaveFocus();
    expect(screen.queryByText("image-only.pdf")).not.toBeInTheDocument();

    fireEvent.change(lectureTextarea, {
      target: { value: "A text alternative for the image-only lecture." },
    });
    await user.click(
      screen.getByRole("button", { name: "Validate lecture text now" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Build local source map" }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "Your local source map is ready.",
      }),
    ).toBeVisible();
    expect(mockProcessSourceFiles.mock.calls.at(-1)?.[0].slides.name).toBe(
      "pasted-lecture.txt",
    );
  });

  it("does not offer PDF recovery for a lecture TXT validation error", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    const invalidText = new File(["\u0000"], "lecture.txt", {
      type: "text/plain",
    });
    mockProcessSourceFiles.mockRejectedValueOnce(
      new SourceProcessingError(
        "binary_text",
        "slides",
        "lecture.txt appears to contain binary content.",
      ),
    );

    render(<LectureWeaver />);
    await user.click(
      within(
        screen.getByRole("group", { name: "Choose lecture material type" }),
      ).getByRole("button", { name: "TXT file" }),
    );
    await user.upload(
      screen.getByLabelText("Choose lecture TXT file"),
      invalidText,
    );
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", { name: "Build local source map" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "lecture.txt appears to contain binary content.",
    );
    expect(
      screen.queryByRole("button", { name: "Use lecture text instead" }),
    ).not.toBeInTheDocument();
  });

  it("uses a masked current-tab key for an otherwise unconfigured live provider", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    const temporaryKey = "temporary-deepseek-key-123456";
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRequestLiveAnalysis.mockResolvedValue(liveResult);

    render(<LectureWeaver providers={temporaryKeyCatalog} />);

    const deepSeekKeyInput = screen.getByLabelText(
      "Temporary DeepSeek API key",
    );
    expect(deepSeekKeyInput).toHaveAttribute("type", "password");
    expect(deepSeekKeyInput).toHaveAttribute("autocomplete", "off");
    expect(deepSeekKeyInput).toHaveAttribute("autocapitalize", "none");
    expect(deepSeekKeyInput).toHaveAttribute("spellcheck", "false");
    expect(deepSeekKeyInput).toHaveAttribute("data-1p-ignore", "true");
    expect(deepSeekKeyInput).toHaveAttribute("data-lpignore", "true");
    const liveAnalysisButton = screen.getByRole("button", {
      name: "Extract and analyze with DeepSeek",
    });
    expect(liveAnalysisButton).toBeDisabled();
    expect(liveAnalysisButton).toHaveAccessibleDescription(
      "Enter a valid temporary DeepSeek key above, or configure its deployment key.",
    );

    await user.type(deepSeekKeyInput, temporaryKey);
    expect(screen.getByText("Temporary key active")).toBeVisible();
    expect(liveAnalysisButton).toBeDisabled();
    expect(liveAnalysisButton).toHaveAccessibleDescription(
      "Add lecture material, a transcript, or a completed audio transcription. Only one is required.",
    );

    await user.upload(
      screen.getByLabelText("Choose lecture PDF file"),
      selectedFiles.slides,
    );
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Extract and analyze with DeepSeek",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Needs a careful pass" }),
    ).toBeVisible();
    expect(mockRequestLiveAnalysis).toHaveBeenCalledWith(
      processed,
      { provider: "deepseek", model: "deepseek-v4-pro" },
      { ankiCards: true },
      { outputLanguage: "en", sessionApiKey: temporaryKey },
    );
    expect(mockRequestLiveAnalysis).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(temporaryKey)).not.toBeInTheDocument();
    expect(window.location.href).not.toContain(temporaryKey);
  });

  it("passes the visible Kimi region with a temporary Kimi key", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    const temporaryKey = "temporary-kimi-key-123456";
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRequestLiveAnalysis.mockResolvedValue(kimiLiveResult);

    render(<LectureWeaver providers={temporaryKeyCatalog} />);
    await user.selectOptions(screen.getByLabelText("AI provider"), "kimi");
    await user.type(
      screen.getByLabelText("Temporary Kimi API key"),
      temporaryKey,
    );
    const kimiRegion = screen.getByLabelText("Kimi API region");
    expect(kimiRegion).toHaveValue("");
    const kimiAnalysisButton = screen.getByRole("button", {
      name: "Extract and analyze with Kimi",
    });
    expect(kimiAnalysisButton).toBeDisabled();
    expect(kimiAnalysisButton).toHaveAccessibleDescription(
      "Choose the Kimi API region before analysis.",
    );
    expect(mockRequestLiveAnalysis).not.toHaveBeenCalled();
    await user.selectOptions(
      kimiRegion,
      "global",
    );
    await user.upload(
      screen.getByLabelText("Choose lecture PDF file"),
      selectedFiles.slides,
    );
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", { name: "Extract and analyze with Kimi" }),
    );

    await screen.findByText("Live analysis · Kimi · kimi-k3");
    expect(mockRequestLiveAnalysis).toHaveBeenCalledWith(
      processed,
      { provider: "kimi", model: "kimi-k3" },
      { ankiCards: true },
      {
        outputLanguage: "en",
        sessionApiKey: temporaryKey,
        sessionKimiRegion: "global",
      },
    );
    expect(mockRequestLiveAnalysis).toHaveBeenCalledTimes(1);
  });

  it("clears temporary keys individually, together, on reset, and on pagehide without browser persistence", async () => {
    const user = userEvent.setup();
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");

    render(<LectureWeaver providers={temporaryKeyCatalog} />);
    const openAiInput = screen.getByLabelText("Temporary OpenAI API key");
    const deepSeekInput = screen.getByLabelText("Temporary DeepSeek API key");
    const kimiInput = screen.getByLabelText("Temporary Kimi API key");
    const kimiRegion = screen.getByLabelText("Kimi API region");

    await user.type(openAiInput, "temporary-openai-key-123456");
    await user.type(deepSeekInput, "temporary-deepseek-key-123456");
    await user.click(screen.getByRole("button", { name: "Clear OpenAI key" }));
    expect(openAiInput).toHaveValue("");
    expect(deepSeekInput).toHaveValue("temporary-deepseek-key-123456");

    await user.type(kimiInput, "temporary-kimi-key-123456");
    await user.selectOptions(kimiRegion, "global");
    await user.click(screen.getByRole("button", { name: "Clear Kimi key" }));
    expect(kimiInput).toHaveValue("");
    expect(kimiRegion).toHaveValue("");

    await user.type(kimiInput, "temporary-kimi-key-123456");
    await user.selectOptions(kimiRegion, "cn");
    await user.click(
      screen.getByRole("button", { name: "Clear all temporary keys" }),
    );
    expect(deepSeekInput).toHaveValue("");
    expect(kimiInput).toHaveValue("");
    expect(kimiRegion).toHaveValue("");

    await user.type(deepSeekInput, "temporary-deepseek-key-123456");
    await user.type(kimiInput, "temporary-kimi-key-123456");
    await user.selectOptions(kimiRegion, "global");
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(deepSeekInput).toHaveValue("");
    expect(kimiInput).toHaveValue("");
    expect(kimiRegion).toHaveValue("");

    await user.type(openAiInput, "temporary-openai-key-123456");
    await user.type(kimiInput, "temporary-kimi-key-123456");
    await user.selectOptions(kimiRegion, "cn");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(openAiInput).toHaveValue("");
    expect(kimiInput).toHaveValue("");
    expect(kimiRegion).toHaveValue("");
    expect(storageWrite).not.toHaveBeenCalled();
  });

  it("analyzes a preserved source map with a valid temporary provider key", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    const temporaryKey = "temporary-deepseek-source-map-key-123456";
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRequestLiveAnalysis.mockResolvedValue(liveResult);

    render(<LectureWeaver providers={temporaryKeyCatalog} />);
    await user.type(
      screen.getByLabelText("Temporary DeepSeek API key"),
      temporaryKey,
    );
    await user.upload(
      screen.getByLabelText("Choose lecture PDF file"),
      selectedFiles.slides,
    );
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", { name: "Build local source map" }),
    );

    const analyzePreserved = await screen.findByRole("button", {
      name: "Analyze current source map with DeepSeek",
    });
    expect(screen.getByText(/Nothing has been sent to DeepSeek yet/)).toBeVisible();
    expect(mockRequestLiveAnalysis).not.toHaveBeenCalled();

    await user.click(analyzePreserved);
    await screen.findByText("Live analysis · DeepSeek · deepseek-v4-pro");
    expect(mockRequestLiveAnalysis).toHaveBeenCalledWith(
      processed,
      { provider: "deepseek", model: "deepseek-v4-pro" },
      { ankiCards: true },
      { outputLanguage: "en", sessionApiKey: temporaryKey },
    );
    expect(mockRequestLiveAnalysis).toHaveBeenCalledTimes(1);
  });

  it("runs configured live analysis with the selected provider and model", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRequestLiveAnalysis.mockResolvedValue(liveResult);

    render(<LectureWeaver providers={configuredProviders} />);

    expect(screen.getByLabelText("AI provider")).toHaveValue("deepseek");
    expect(screen.getByLabelText("AI model")).toHaveValue(
      "deepseek-v4-pro",
    );
    await user.upload(
      screen.getByLabelText("Choose lecture PDF file"),
      selectedFiles.slides,
    );
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Extract and analyze with DeepSeek",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Needs a careful pass" }),
    ).toBeVisible();
    expect(mockRequestLiveAnalysis).toHaveBeenCalledWith(
      processed,
      {
        provider: "deepseek",
        model: "deepseek-v4-pro",
      },
      { ankiCards: true },
      { outputLanguage: "en" },
    );
    expect(mockRequestLiveAnalysis).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(
        "Live analysis · DeepSeek · deepseek-v4-pro",
      ),
    ).toBeVisible();
    expect(screen.getByText("DeepSeek · deepseek-v4-pro")).toBeVisible();
    expect(mockRunFixtureAnalysis).not.toHaveBeenCalled();
  });

  it("sets expectations while a live provider is processing a large source map", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    const pendingAnalysis = deferred<AnalysisResult>();
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRequestLiveAnalysis.mockReturnValue(pendingAnalysis.promise);

    render(<LectureWeaver providers={configuredProviders} />);
    await user.upload(
      screen.getByLabelText("Choose lecture PDF file"),
      selectedFiles.slides,
    );
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Extract and analyze with DeepSeek",
      }),
    );

    const waitHint = await screen.findByText(
      "Large source maps can take up to about 3 minutes. Keep this tab open while the selected provider finishes.",
    );
    expect(waitHint.closest("section")).toHaveAttribute("aria-busy", "true");

    await user.click(
      screen.getByRole("button", { name: "Language: 简体中文" }),
    );
    expect(
      screen.getByText(
        "较大的来源地图可能需要约 3 分钟。请保持当前标签页打开，等待所选服务商完成。",
      ),
    ).toBeVisible();

    await act(async () => {
      pendingAnalysis.resolve(liveResult);
      await pendingAnalysis.promise;
    });
    expect(
      await screen.findByRole("heading", { name: "需要仔细复查" }),
    ).toBeVisible();
  });

  it("honors the optional Anki switch in the live request and result workspace", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRequestLiveAnalysis.mockResolvedValue(noAnkiLiveResult);

    render(<LectureWeaver providers={configuredProviders} />);
    const ankiOption = screen.getByRole("checkbox", {
      name: /Create Anki cards/,
    });
    expect(ankiOption).toBeChecked();
    await user.click(ankiOption);
    expect(ankiOption).not.toBeChecked();

    await user.upload(screen.getByLabelText("Choose lecture PDF file"), selectedFiles.slides);
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", { name: "Extract and analyze with DeepSeek" }),
    );

    await screen.findByRole("heading", { name: "Needs a careful pass" });
    expect(mockRequestLiveAnalysis).toHaveBeenCalledWith(
      processed,
      { provider: "deepseek", model: "deepseek-v4-pro" },
      { ankiCards: false },
      { outputLanguage: "en" },
    );
    expect(mockRequestLiveAnalysis).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Anki cards · 0" }));
    expect(
      screen.getByRole("heading", { name: "Anki cards were not requested." }),
    ).toBeVisible();
  });

  it("preserves the current study pack when changing the next-run Anki option", async () => {
    const user = await renderReady();
    const ankiOption = screen.getByRole("checkbox", {
      name: /Create Anki cards/,
    });

    await user.click(ankiOption);

    expect(ankiOption).not.toBeChecked();
    expect(screen.getByRole("heading", { name: "Enhanced notes" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Anki cards · 4" })).toBeVisible();
  });

  it("opens trusted enhanced-note sources", async () => {
    const user = await renderReady();
    const sectionHeading = screen.getByRole("heading", {
      name: "Retrieval practice",
    });
    const sectionCard = sectionHeading.closest("article");
    expect(sectionCard).not.toBeNull();

    await user.click(
      within(sectionCard as HTMLElement).getByRole("button", {
        name: "Inspect section sources",
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "Retrieval practice" });
    expect(within(dialog).getByText("Enhanced-note sources")).toBeVisible();
    expect(within(dialog).getByText("sample.pdf")).toBeVisible();
    expect(within(dialog).getByText("Page 1")).toBeVisible();
  });

  it("preserves the source map after a live failure and retries in place", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRequestLiveAnalysis
      .mockRejectedValueOnce(
        new LiveAnalysisError(
          "rate_limited",
          "DeepSeek is rate-limiting analysis requests. Please retry later.",
          true,
        ),
      )
      .mockResolvedValueOnce(liveResult);

    render(<LectureWeaver providers={configuredProviders} />);
    await user.upload(
      screen.getByLabelText("Choose lecture PDF file"),
      selectedFiles.slides,
    );
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Extract and analyze with DeepSeek",
      }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("rate-limiting analysis requests");
    expect(screen.getByText("Local source map ready")).toBeVisible();
    expect(screen.getAllByText("sample.pdf").length).toBeGreaterThan(0);

    await user.click(
      screen.getByRole("button", { name: "Retry live analysis" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Needs a careful pass" }),
    ).toBeVisible();
    expect(mockRequestLiveAnalysis).toHaveBeenCalledTimes(2);
    expect(mockProcessSourceFiles).toHaveBeenCalledTimes(1);
  });

  it("shows timeout-specific recovery and retries the preserved map with lighter outputs", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRequestLiveAnalysis
      .mockRejectedValueOnce(
        new LiveAnalysisError(
          "provider_timeout",
          "DeepSeek did not finish within the analysis time limit.",
          true,
        ),
      )
      .mockResolvedValueOnce(noAnkiLiveResult);

    render(<LectureWeaver providers={configuredProviders} />);
    await user.upload(
      screen.getByLabelText("Choose lecture PDF file"),
      selectedFiles.slides,
    );
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Extract and analyze with DeepSeek",
      }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Retry once. If it times out again, choose DeepSeek V4 Flash, turn off optional Anki cards, or select another credential-ready provider.",
    );
    expect(screen.getByText("Local source map ready")).toBeVisible();

    await user.click(
      screen.getByRole("checkbox", { name: /Create Anki cards/ }),
    );
    await user.click(
      screen.getByRole("button", { name: "Retry live analysis" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Needs a careful pass" }),
    ).toBeVisible();
    expect(mockRequestLiveAnalysis).toHaveBeenLastCalledWith(
      processed,
      { provider: "deepseek", model: "deepseek-v4-pro" },
      { ankiCards: false },
      { outputLanguage: "en" },
    );
    expect(mockProcessSourceFiles).toHaveBeenCalledTimes(1);
  });

  it("hides retry for non-retryable live failures", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRequestLiveAnalysis.mockRejectedValue(
      new LiveAnalysisError(
        "provider_balance",
        "DeepSeek reports insufficient API balance.",
        false,
      ),
    );

    render(<LectureWeaver providers={configuredProviders} />);
    await user.upload(
      screen.getByLabelText("Choose lecture PDF file"),
      selectedFiles.slides,
    );
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Extract and analyze with DeepSeek",
      }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "insufficient API balance",
    );
    expect(
      screen.queryByRole("button", { name: "Retry live analysis" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Local source map ready")).toBeVisible();
  });

  it("switches provider after an error and analyzes the preserved source map", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles();
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRequestLiveAnalysis
      .mockRejectedValueOnce(
        new LiveAnalysisError(
          "rate_limited",
          "DeepSeek is temporarily rate-limited.",
          true,
        ),
      )
      .mockResolvedValueOnce(kimiLiveResult);

    render(<LectureWeaver providers={multiProviderCatalog} />);
    await user.upload(
      screen.getByLabelText("Choose lecture PDF file"),
      selectedFiles.slides,
    );
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Extract and analyze with DeepSeek",
      }),
    );
    await screen.findByRole("alert");

    await user.selectOptions(screen.getByLabelText("AI provider"), "kimi");
    const preservedSourceAction = await screen.findByRole("button", {
      name: "Analyze current source map with Kimi",
    });
    expect(screen.getByText(/Nothing has been sent to Kimi yet/)).toBeVisible();
    await user.click(preservedSourceAction);

    expect(
      await screen.findByText("Live analysis · Kimi · kimi-k3"),
    ).toBeVisible();
    expect(mockRequestLiveAnalysis).toHaveBeenLastCalledWith(
      processed,
      {
        provider: "kimi",
        model: "kimi-k3",
      },
      { ankiCards: true },
      { outputLanguage: "en" },
    );
    expect(mockProcessSourceFiles).toHaveBeenCalledTimes(1);
  });

  it("retries a failed no-key demo without calling live analysis", async () => {
    const user = userEvent.setup();
    const files = sourceFiles();
    mockLoadDemoFiles
      .mockRejectedValueOnce(new Error("The sample asset could not be loaded."))
      .mockResolvedValueOnce(files);
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRunFixtureAnalysis.mockResolvedValue(result);

    render(<LectureWeaver providers={configuredProviders} />);
    await user.click(
      screen.getByRole("button", { name: "Try the sample lecture" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "sample asset could not be loaded",
    );
    await user.click(
      screen.getByRole("button", { name: "Retry included demo" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Needs a careful pass" }),
    ).toBeVisible();
    expect(mockLoadDemoFiles).toHaveBeenCalledTimes(2);
    expect(mockRequestLiveAnalysis).not.toHaveBeenCalled();
  });

  it("recovers the included demo from a browser PDF worker failure without a live request", async () => {
    const user = userEvent.setup();
    const files = sourceFiles();
    const fallbackFiles: SourceFiles = {
      ...files,
      slides: new File(["Page-aligned sample text"], "lecture-pages.txt", {
        type: "text/plain",
      }),
    };
    const fallbackProcessed: ProcessedSources = {
      ...processed,
      chunks: processed.chunks.map((chunk) =>
        chunk.sourceType === "slides"
          ? { ...chunk, sourceName: "lecture-pages.txt" }
          : chunk,
      ),
    };
    const extractionError = new SourceProcessingError(
      "invalid_pdf",
      "slides",
      "The PDF worker could not start.",
    );
    mockLoadDemoFiles.mockResolvedValue(files);
    mockProcessSourceFiles.mockRejectedValue(extractionError);
    mockRecoverDemoPdfExtraction.mockResolvedValue({
      files: fallbackFiles,
      processed: fallbackProcessed,
    });
    mockRunFixtureAnalysis.mockResolvedValue(result);

    render(<LectureWeaver providers={configuredProviders} />);
    await user.click(
      screen.getByRole("button", { name: "Try the sample lecture" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Needs a careful pass" }),
    ).toBeVisible();
    expect(screen.getAllByText("lecture-pages.txt").length).toBeGreaterThan(0);
    expect(mockRecoverDemoPdfExtraction).toHaveBeenCalledWith(
      extractionError,
      files,
    );
    expect(mockRunFixtureAnalysis).toHaveBeenCalledWith(
      fallbackProcessed,
      { ankiCards: true },
    );
    expect(mockRequestLiveAnalysis).not.toHaveBeenCalled();
  });

  it("shows the checked-in files if both demo extraction paths fail", async () => {
    const user = userEvent.setup();
    const selectedFiles = sourceFiles("student.pdf");
    const demoFiles = sourceFiles("lecture.pdf");
    const extractionError = new SourceProcessingError(
      "invalid_pdf",
      "slides",
      "The PDF worker could not start.",
    );
    mockLoadDemoFiles.mockResolvedValue(demoFiles);
    mockProcessSourceFiles.mockRejectedValue(extractionError);
    mockRecoverDemoPdfExtraction.mockRejectedValue(
      new Error("The included page-text fallback could not be loaded."),
    );

    render(<LectureWeaver providers={configuredProviders} />);
    await user.upload(
      screen.getByLabelText("Choose lecture PDF file"),
      selectedFiles.slides,
    );
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      selectedFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      selectedFiles.notes,
    );
    expect(screen.getByText("student.pdf")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Try the sample lecture" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "page-text fallback could not be loaded",
    );
    expect(screen.getAllByText("lecture.pdf").length).toBeGreaterThan(0);
    expect(screen.queryByText("student.pdf")).not.toBeInTheDocument();
  });

  it("never treats a fixture fingerprint mismatch as a PDF compatibility failure", async () => {
    const user = userEvent.setup();
    const files = sourceFiles();
    const expected = {
      slides: "a".repeat(64),
      transcript: "b".repeat(64),
      notes: "c".repeat(64),
    } as const;
    const actual = { ...expected, slides: "d".repeat(64) };
    mockLoadDemoFiles.mockResolvedValue(files);
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRunFixtureAnalysis.mockRejectedValue(
      new DemoFingerprintMismatchError(expected, actual),
    );

    render(<LectureWeaver providers={configuredProviders} />);
    await user.click(
      screen.getByRole("button", { name: "Try the sample lecture" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "do not match the checked-in demo corpus",
    );
    expect(mockRecoverDemoPdfExtraction).not.toHaveBeenCalled();
    expect(mockRequestLiveAnalysis).not.toHaveBeenCalled();
  });

  it("retranslates a failed no-key demo and retries it in Chinese", async () => {
    const user = userEvent.setup();
    const files = sourceFiles();
    mockLoadDemoFiles
      .mockRejectedValueOnce(new Error("The sample asset could not be loaded."))
      .mockResolvedValueOnce(files);
    mockProcessSourceFiles.mockResolvedValue(processed);
    mockRunFixtureAnalysis.mockResolvedValue(result);

    render(<LectureWeaver providers={configuredProviders} />);
    await user.click(
      screen.getByRole("button", { name: "Try the sample lecture" }),
    );

    const alert = await screen.findByRole("alert");
    await user.click(
      screen.getByRole("button", { name: "Language: 简体中文" }),
    );

    expect(
      within(alert).getByRole("heading", { name: "内置演示未能加载。" }),
    ).toBeVisible();
    expect(alert).toHaveTextContent("The sample asset could not be loaded.");
    expect(alert).toHaveTextContent(
      "请对同一套内置样例重试；不会发起实时模型请求。",
    );

    await user.click(
      within(alert).getByRole("button", { name: "重试演示" }),
    );

    expect(
      await screen.findByRole("heading", { name: "需要仔细复查" }),
    ).toBeVisible();
    expect(mockLoadDemoFiles).toHaveBeenCalledTimes(2);
    expect(mockRequestLiveAnalysis).not.toHaveBeenCalled();
  });

  it("copies and downloads the exact enhanced-notes Markdown string", async () => {
    const user = await renderReady();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    let downloadedName: string | null = null;
    let downloadedHref: string | null = null;
    let downloadedBlob: Blob | null = null;
    vi.mocked(URL.createObjectURL).mockImplementation((blob) => {
      if (!(blob instanceof Blob)) {
        throw new TypeError("Expected the enhanced-notes download to use a Blob.");
      }
      downloadedBlob = blob;
      return "blob:lectureweaver-patch";
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedName = this.download;
      downloadedHref = this.href;
    });

    await user.click(screen.getByRole("button", { name: "Copy full notes" }));
    expect(writeText).toHaveBeenCalledWith(result.enhancedMarkdown);
    expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(screen.getByText("Copy full notes copied to clipboard.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Export Markdown" }));
    expect(downloadedName).toBe("lectureweaver-enhanced-notes.md");
    expect(downloadedHref).toContain("blob:lectureweaver-patch");
    expect(downloadedBlob).not.toBeNull();
    const readDownloadedBlob = (): Blob => {
      if (downloadedBlob === null) {
        throw new Error("The download did not create a Markdown Blob.");
      }
      return downloadedBlob;
    };
    expect(await readDownloadedBlob().text()).toBe(result.enhancedMarkdown);
  });

  it("previews, copies, and downloads the exact Anki import text", async () => {
    const user = await renderReady();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    let downloadedName: string | null = null;
    let downloadedBlob: Blob | null = null;
    vi.mocked(URL.createObjectURL).mockImplementation((blob) => {
      if (!(blob instanceof Blob)) throw new TypeError("Expected an Anki Blob.");
      downloadedBlob = blob;
      return "blob:lectureweaver-anki";
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedName = this.download;
    });

    await user.click(screen.getByRole("button", { name: "Anki cards · 4" }));
    expect(screen.getByRole("heading", { name: "4 Anki-ready cards" })).toBeVisible();
    expect(screen.getByText("What should you know about Retrieval practice?")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Copy Anki text" }));
    expect(writeText).toHaveBeenCalledWith(result.ankiImportText);
    await user.click(screen.getByRole("button", { name: "Download Anki .txt" }));
    expect(downloadedName).toBe("lectureweaver-anki.txt");
    const readDownloadedBlob = (): Blob => {
      if (downloadedBlob === null) {
        throw new Error("The Anki download was not created.");
      }
      return downloadedBlob;
    };
    expect(await readDownloadedBlob().text()).toBe(result.ankiImportText);
    expect(readDownloadedBlob().type).toBe("text/plain;charset=utf-8");
  });
});
