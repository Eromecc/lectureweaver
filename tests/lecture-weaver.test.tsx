import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SVGProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModelAnalysisSchema, SourceChunkListSchema } from "@/domain";
import {
  calculateCoverageMetrics,
  generateMarkdownPatch,
  hydrateAnalysis,
} from "@/lib/analysis";
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

vi.mock("lucide-react", () => {
  const Icon = (props: SVGProps<SVGSVGElement>) => <svg {...props} />;
  return {
    AlertTriangle: Icon,
    ArrowRight: Icon,
    Check: Icon,
    ChevronRight: Icon,
    CircleCheck: Icon,
    Clipboard: Icon,
    Download: Icon,
    Eye: Icon,
    FileText: Icon,
    LoaderCircle: Icon,
    Lock: Icon,
    NotebookPen: Icon,
    Presentation: Icon,
    RotateCcw: Icon,
    ScanText: Icon,
    ShieldCheck: Icon,
    Sparkles: Icon,
    Upload: Icon,
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

const modelAnalysis = ModelAnalysisSchema.parse({
  summary:
    "The notes preserve one concept, partially cover another, omit a feedback loop, and contradict the source on rereading.",
  assessments: [
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
});

const hydrated = hydrateAnalysis(modelAnalysis, chunks);

const processed: ProcessedSources = {
  chunks,
  totalCharacters: chunks.reduce((total, chunk) => total + chunk.text.length, 0),
  counts: { slides: 1, transcript: 1, notes: 1 },
};

const result: DemoAnalysisResult = {
  hydrated,
  metrics: calculateCoverageMetrics(modelAnalysis.assessments),
  markdown: generateMarkdownPatch(hydrated),
  fingerprints: {
    slides: "a".repeat(64),
    transcript: "b".repeat(64),
    notes: "c".repeat(64),
  },
};

const mockLoadDemoFiles = vi.mocked(loadDemoFiles);
const mockProcessSourceFiles = vi.mocked(processSourceFiles);
const mockRunFixtureAnalysis = vi.mocked(runFixtureAnalysis);

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
  vi.clearAllMocks();
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

    render(<LectureWeaver />);

    expect(
      screen.getByRole("button", { name: "Process sources" }),
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
      screen.getByRole("button", { name: "Process sources" }),
    ).toBeDisabled();

    await act(async () => {
      processing.resolve(processed);
      await processing.promise;
    });

    expect(
      await screen.findByRole("heading", { name: "Needs a careful pass" }),
    ).toBeVisible();
    expect(mockRunFixtureAnalysis).toHaveBeenCalledWith(processed);
    expect(screen.getByText("38")).toBeVisible();
    expect(screen.getByText("4 concepts audited")).toBeVisible();
    expect(screen.getByText("Sample fingerprint verified")).toBeVisible();
    expect(screen.getAllByText("sample.pdf").length).toBeGreaterThan(0);
  });

  it("filters the actionable review queue without hard-coded result cards", async () => {
    const user = await renderReady();

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

    render(<LectureWeaver />);
    await user.upload(screen.getByLabelText("Choose slides file"), invalidFiles.slides);
    await user.upload(
      screen.getByLabelText("Choose transcript file"),
      invalidFiles.transcript,
    );
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      invalidFiles.notes,
    );
    await user.click(screen.getByRole("button", { name: "Process sources" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "The selected PDF does not have a valid PDF signature.",
    );
    expect(screen.getByText("invalid.pdf")).toBeVisible();

    await user.upload(screen.getByLabelText("Choose slides file"), replacementPdf);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("replacement.pdf")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Process sources" }));

    expect(
      await screen.findByRole("heading", { name: "Needs a careful pass" }),
    ).toBeVisible();
    const retriedFiles = mockProcessSourceFiles.mock.calls.at(-1)?.[0];
    expect(retriedFiles?.slides).toBe(replacementPdf);
  });

  it("copies and downloads the exact generated Markdown string", async () => {
    const user = await renderReady();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    let downloadedName: string | null = null;
    let downloadedHref: string | null = null;
    let downloadedBlob: Blob | null = null;
    vi.mocked(URL.createObjectURL).mockImplementation((blob) => {
      if (!(blob instanceof Blob)) {
        throw new TypeError("Expected the Markdown download to use a Blob.");
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

    await user.click(screen.getByRole("button", { name: "Copy Markdown" }));
    expect(writeText).toHaveBeenCalledWith(result.markdown);
    expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(screen.getByText("Markdown copied to clipboard.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Download .md" }));
    expect(downloadedName).toBe("lectureweaver-additions.md");
    expect(downloadedHref).toContain("blob:lectureweaver-patch");
    expect(downloadedBlob).not.toBeNull();
    const readDownloadedBlob = (): Blob => {
      if (downloadedBlob === null) {
        throw new Error("The download did not create a Markdown Blob.");
      }
      return downloadedBlob;
    };
    expect(await readDownloadedBlob().text()).toBe(result.markdown);
  });
});
