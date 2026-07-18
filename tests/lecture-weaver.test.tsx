import { act, render, screen, waitFor, within } from "@testing-library/react";
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
  loadDemoFiles,
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
    expect(screen.getByLabelText("Choose slides file")).toHaveAttribute(
      "accept",
      expect.stringContaining(".pdf"),
    );
    expect(screen.getByLabelText("Choose transcript file")).toBeEnabled();
    expect(screen.getByLabelText("Choose existing notes file")).toBeEnabled();

    await user.click(
      screen.getByRole("button", { name: "Try the sample lecture" }),
    );

    await waitFor(() => expect(mockProcessSourceFiles).toHaveBeenCalledWith(files));
    expect(screen.getByText("Extracting pages and paragraph structure…")).toBeVisible();
    expect(
      screen.getByText("Extracting pages and paragraph structure…").closest("section"),
    ).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByRole("button", { name: "Build local source map" }),
    ).toBeDisabled();

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
    await user.upload(screen.getByLabelText("Choose slides file"), invalidFiles.slides);
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

    await user.upload(screen.getByLabelText("Choose slides file"), replacementPdf);
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
      screen.getByLabelText("Choose slides file"),
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
    );
    expect(
      screen.getByText(
        "Live analysis · DeepSeek · deepseek-v4-pro",
      ),
    ).toBeVisible();
    expect(screen.getByText("DeepSeek · deepseek-v4-pro")).toBeVisible();
    expect(mockRunFixtureAnalysis).not.toHaveBeenCalled();
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

    await user.upload(screen.getByLabelText("Choose slides file"), selectedFiles.slides);
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
    );
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
      screen.getByLabelText("Choose slides file"),
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
      screen.getByLabelText("Choose slides file"),
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
      screen.getByLabelText("Choose slides file"),
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
