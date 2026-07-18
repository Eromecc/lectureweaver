import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LectureWeaver } from "@/components/lecture-weaver";
import {
  MAX_SPEECH_INPUT_CHARACTERS,
  PublicProviderCatalogSchema,
  SourceChunkListSchema,
  type AudioTranscriptionSuccess,
} from "@/domain";
import {
  buildAnalysisResult,
  buildNarrationScripts,
} from "@/lib/analysis";
import {
  AudioClientError,
  requestAudioTranscription,
  requestStudyGuideSpeech,
} from "@/lib/ai/audio-client";
import {
  loadDemoFiles,
  runFixtureAnalysis,
  type DemoAnalysisResult,
} from "@/lib/demo";
import {
  processSourceFiles,
  processSourceFilesWithTranscriptChunks,
} from "@/lib/extraction";
import type { ProcessedSources, SourceFiles } from "@/lib/extraction";

import { buildTestAnalysis } from "./analysis-fixtures";

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
    processSourceFilesWithTranscriptChunks: vi.fn(),
  };
});

vi.mock("@/lib/ai/audio-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/audio-client")>(
    "@/lib/ai/audio-client",
  );
  return {
    ...actual,
    requestAudioTranscription: vi.fn(),
    requestStudyGuideSpeech: vi.fn(),
  };
});

const demoChunks = SourceChunkListSchema.parse([
  {
    id: "slides:p0001:c01",
    sourceType: "slides",
    sourceName: "sample.pdf",
    locator: "Page 1",
    text: "Retrieval practice strengthens access to a memory.",
  },
  {
    id: "transcript:p0001:c01",
    sourceType: "transcript",
    sourceName: "sample.txt",
    locator: "Paragraph 1",
    text: "The lecturer asks learners to retrieve before reviewing.",
  },
  {
    id: "notes:p0001:c01",
    sourceType: "notes",
    sourceName: "sample.md",
    locator: "Paragraph 1",
    headingPath: ["Retrieval practice"],
    text: "Retrieval is an active study strategy.",
  },
]);

const demoProcessed: ProcessedSources = {
  chunks: demoChunks,
  totalCharacters: demoChunks.reduce((total, chunk) => total + chunk.text.length, 0),
  counts: { slides: 1, transcript: 1, notes: 1 },
};

const modelAnalysis = buildTestAnalysis(
  [
    {
      id: "retrieval",
      title: "Retrieval practice",
      importance: "core",
      status: "covered",
      explanation: "The notes preserve the lecture's central retrieval claim.",
      evidenceRefs: [
        { chunkId: "slides:p0001:c01", relevance: "Defines the strategy." },
        { chunkId: "notes:p0001:c01", relevance: "Shows it is already covered." },
      ],
    },
  ],
  { includeAnki: false },
);

const demoResult: DemoAnalysisResult = {
  ...buildAnalysisResult(
    modelAnalysis,
    demoChunks,
    { kind: "demo" },
    { ankiCards: false },
  ),
  fingerprints: {
    slides: "a".repeat(64),
    transcript: "b".repeat(64),
    notes: "c".repeat(64),
  },
};

const sourceFiles: SourceFiles = {
  slides: new File(["%PDF-synthetic"], "sample.pdf", { type: "application/pdf" }),
  transcript: new File(["Synthetic transcript"], "sample.txt", {
    type: "text/plain",
  }),
  notes: new File(["# Retrieval practice"], "sample.md", {
    type: "text/markdown",
  }),
};

const configuredAudioProvider = PublicProviderCatalogSchema.parse({
  providers: [
    {
      id: "openai",
      label: "OpenAI",
      description: "Mocked OpenAI provider.",
      configured: true,
      defaultModel: "gpt-5.6",
      models: [
        {
          id: "gpt-5.6",
          label: "GPT-5.6 Sol",
          description: "Mocked analysis model.",
        },
      ],
    },
  ],
});

const transcription: AudioTranscriptionSuccess = {
  model: "gpt-4o-transcribe-diarize",
  fileName: "lecture.mp3",
  text: "Speaker A: Retrieval practice requires an attempt.\n\nSpeaker A: Feedback follows the attempt.",
  durationSeconds: 18,
  segments: [
    {
      startSeconds: 0,
      endSeconds: 8,
      speaker: "Speaker A",
      text: "Retrieval practice requires an attempt.",
    },
    {
      startSeconds: 8,
      endSeconds: 18,
      speaker: "Speaker A",
      text: "Feedback follows the attempt.",
    },
  ],
};

const audioChunks = SourceChunkListSchema.parse([
  demoChunks[0],
  {
    id: "transcript:t000000000-t000018000:c01",
    sourceType: "transcript",
    sourceName: "lecture.mp3",
    locator: "00:00–00:18",
    text: transcription.text,
  },
  demoChunks[2],
]);

const audioProcessed: ProcessedSources = {
  chunks: audioChunks,
  totalCharacters: audioChunks.reduce((total, chunk) => total + chunk.text.length, 0),
  counts: { slides: 1, transcript: 1, notes: 1 },
};

const mockLoadDemoFiles = vi.mocked(loadDemoFiles);
const mockRunFixtureAnalysis = vi.mocked(runFixtureAnalysis);
const mockProcessSourceFiles = vi.mocked(processSourceFiles);
const mockProcessAudioSources = vi.mocked(processSourceFilesWithTranscriptChunks);
const mockRequestTranscription = vi.mocked(requestAudioTranscription);
const mockRequestSpeech = vi.mocked(requestStudyGuideSpeech);

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function requestSignal(input: unknown): AbortSignal {
  if (
    typeof input !== "object" ||
    input === null ||
    !("signal" in input) ||
    !(input.signal instanceof AbortSignal)
  ) {
    throw new Error("Expected the audio request to receive an AbortSignal.");
  }
  return input.signal;
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
    value: vi.fn(() => "blob:lectureweaver-audio"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LectureWeaver audio workflow", () => {
  it("transcribes an explicit audio upload and feeds timestamp chunks into the source map", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    let downloadedName: string | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedName = this.download;
    });
    const audioFile = new File([new Uint8Array([0x49, 0x44, 0x33, 0x04])], "raw lecture.mp3", {
      type: "audio/mpeg",
    });
    mockRequestTranscription.mockResolvedValue(transcription);
    mockProcessAudioSources.mockResolvedValue(audioProcessed);

    render(<LectureWeaver providers={configuredAudioProvider} />);

    await user.click(screen.getByRole("button", { name: "Lecture audio" }));
    const spokenSource = screen
      .getByRole("heading", { name: "Transcript or audio" })
      .closest("article");
    expect(spokenSource).not.toBeNull();
    expect(
      within(spokenSource as HTMLElement).getByText(
        /raw audio bytes pass through the LectureWeaver server to OpenAI/,
      ),
    ).toBeVisible();
    expect(
      within(spokenSource as HTMLElement).getByText(
        /neither stores nor logs the recording or transcript/,
      ),
    ).toBeVisible();

    await user.upload(screen.getByLabelText("Choose lecture audio file"), audioFile);
    await user.click(
      screen.getByRole("button", { name: "Send to OpenAI & transcribe" }),
    );

    expect(await screen.findByText("Timestamped transcript ready")).toBeVisible();
    expect(screen.getByText(/0:18 · 2 segments/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy transcript" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Download .txt" })).toBeVisible();
    expect(mockRequestTranscription).toHaveBeenCalledWith(
      audioFile,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    await user.click(screen.getByRole("button", { name: "Copy transcript" }));
    expect(writeText).toHaveBeenCalledWith(transcription.text);
    await user.click(screen.getByRole("button", { name: "Download .txt" }));
    expect(downloadedName).toBe("lecture-transcript.txt");
    const transcriptBlob = vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0];
    expect(transcriptBlob).toBeInstanceOf(Blob);
    await expect((transcriptBlob as Blob).text()).resolves.toBe(transcription.text);

    await user.upload(screen.getByLabelText("Choose slides file"), sourceFiles.slides);
    await user.upload(
      screen.getByLabelText("Choose existing notes file"),
      sourceFiles.notes,
    );
    await user.click(screen.getByRole("button", { name: "Build local source map" }));

    expect(
      await screen.findByRole("heading", { name: "Your local source map is ready." }),
    ).toBeVisible();
    const passedChunks = mockProcessAudioSources.mock.calls[0]?.[1];
    expect(passedChunks?.[0]).toMatchObject({
      sourceType: "transcript",
      sourceName: "lecture.mp3",
      locator: "00:00–00:18",
    });
    expect(mockProcessSourceFiles).not.toHaveBeenCalled();
  });

  it("keeps Try demo request-free until the user explicitly generates disclosed speech", async () => {
    const user = userEvent.setup();
    let downloadedName: string | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadedName = this.download;
    });
    mockLoadDemoFiles.mockResolvedValue(sourceFiles);
    mockProcessSourceFiles.mockResolvedValue(demoProcessed);
    mockRunFixtureAnalysis.mockResolvedValue(demoResult);
    mockRequestSpeech.mockResolvedValue({
      blob: new Blob(["synthetic audio"], { type: "audio/mpeg" }),
      fileName: "lectureweaver-study-guide.mp3",
    });

    const { unmount } = render(
      <LectureWeaver providers={configuredAudioProvider} />,
    );
    await user.click(screen.getByRole("button", { name: "Try the sample lecture" }));
    await screen.findByRole("heading", { name: "Enhanced notes" });

    expect(mockRequestTranscription).not.toHaveBeenCalled();
    expect(mockRequestSpeech).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Audio guide" }));
    expect(screen.getByText("AI-generated voice")).toBeVisible();
    expect(screen.getByText(/not a human recording/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Generate audio guide" }));

    const expectedScript = buildNarrationScripts(
      demoResult.hydrated,
      MAX_SPEECH_INPUT_CHARACTERS,
    ).find((script) => script.withinLimit);
    expect(mockRequestSpeech).toHaveBeenCalledWith({
      text: expectedScript?.text,
      voice: "marin",
      format: "mp3",
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    const player = await screen.findByLabelText(/Audio study guide:/);
    expect(player).toHaveAttribute("src", "blob:lectureweaver-audio");

    const playback = player.closest("div");
    expect(playback).not.toBeNull();
    expect(
      within(playback as HTMLElement).getByText(/marin voice · MP3/),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Download MP3" }));
    expect(downloadedName).toBe("lectureweaver-study-guide.mp3");
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:lectureweaver-audio");
  });

  it("shows an actionable transcription error and permits retry", async () => {
    const user = userEvent.setup();
    const audioFile = new File([new Uint8Array([0x49, 0x44, 0x33])], "lecture.mp3", {
      type: "audio/mpeg",
    });
    mockRequestTranscription
      .mockRejectedValueOnce(new Error("Transcription is temporarily unavailable."))
      .mockResolvedValueOnce(transcription);

    render(<LectureWeaver providers={configuredAudioProvider} />);
    await user.click(screen.getByRole("button", { name: "Lecture audio" }));
    await user.upload(screen.getByLabelText("Choose lecture audio file"), audioFile);
    await user.click(
      screen.getByRole("button", { name: "Send to OpenAI & transcribe" }),
    );

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("temporarily unavailable");
    await user.click(screen.getByRole("button", { name: "Retry transcription" }));
    expect(await screen.findByText("Timestamped transcript ready")).toBeVisible();
    expect(mockRequestTranscription).toHaveBeenCalledTimes(2);
  });

  it("does not blame the recording for a non-retryable provider account error", async () => {
    const user = userEvent.setup();
    const audioFile = new File([new Uint8Array([0x49, 0x44, 0x33])], "lecture.mp3", {
      type: "audio/mpeg",
    });
    mockRequestTranscription.mockRejectedValue(
      new AudioClientError(
        "provider_auth",
        "OpenAI rejected the configured audio credential.",
        false,
      ),
    );

    render(<LectureWeaver providers={configuredAudioProvider} />);
    await user.click(screen.getByRole("button", { name: "Lecture audio" }));
    await user.upload(screen.getByLabelText("Choose lecture audio file"), audioFile);
    await user.click(
      await screen.findByRole("button", { name: "Send to OpenAI & transcribe" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "rejected the configured audio credential",
    );
    expect(
      screen.getByRole("button", { name: "Check OpenAI configuration" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Replace invalid audio" }),
    ).not.toBeInTheDocument();
  });

  it("disables unconfigured audio before any paid request is made", async () => {
    const user = userEvent.setup();
    const audioFile = new File([new Uint8Array([0x49, 0x44, 0x33])], "lecture.mp3", {
      type: "audio/mpeg",
    });

    render(<LectureWeaver />);
    await user.click(screen.getByRole("button", { name: "Lecture audio" }));
    expect(
      screen.getByText(/OpenAI audio is not configured on this deployment/),
    ).toBeVisible();
    await user.upload(screen.getByLabelText("Choose lecture audio file"), audioFile);

    expect(
      await screen.findByRole("button", { name: "OpenAI audio unavailable" }),
    ).toBeDisabled();
    expect(mockRequestTranscription).not.toHaveBeenCalled();
  });

  it("shows a speech error and retries without rebuilding the study pack", async () => {
    const user = userEvent.setup();
    mockLoadDemoFiles.mockResolvedValue(sourceFiles);
    mockProcessSourceFiles.mockResolvedValue(demoProcessed);
    mockRunFixtureAnalysis.mockResolvedValue(demoResult);
    mockRequestSpeech
      .mockRejectedValueOnce(
        new AudioClientError(
          "rate_limited",
          "OpenAI is temporarily rate-limiting speech requests.",
          true,
        ),
      )
      .mockResolvedValueOnce({
        blob: new Blob(["synthetic audio"], { type: "audio/mpeg" }),
        fileName: "lectureweaver-study-guide.mp3",
      });

    render(<LectureWeaver providers={configuredAudioProvider} />);
    await user.click(screen.getByRole("button", { name: "Try the sample lecture" }));
    await screen.findByRole("heading", { name: "Enhanced notes" });
    await user.click(screen.getByRole("button", { name: "Audio guide" }));
    await user.click(screen.getByRole("button", { name: "Generate audio guide" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "rate-limiting speech requests",
    );
    await user.click(
      screen.getByRole("button", { name: "Retry audio generation" }),
    );
    expect(await screen.findByLabelText(/Audio study guide:/)).toBeVisible();
    expect(mockRequestSpeech).toHaveBeenCalledTimes(2);
    expect(mockProcessSourceFiles).toHaveBeenCalledTimes(1);
  });

  it("aborts an in-flight transcription when the page unmounts", async () => {
    const user = userEvent.setup();
    const pending = deferred<AudioTranscriptionSuccess>();
    const audioFile = new File([new Uint8Array([0x49, 0x44, 0x33])], "lecture.mp3", {
      type: "audio/mpeg",
    });
    mockRequestTranscription.mockReturnValue(pending.promise);

    const { unmount } = render(
      <LectureWeaver providers={configuredAudioProvider} />,
    );
    await user.click(screen.getByRole("button", { name: "Lecture audio" }));
    await user.upload(screen.getByLabelText("Choose lecture audio file"), audioFile);
    await user.click(
      await screen.findByRole("button", { name: "Send to OpenAI & transcribe" }),
    );

    const signal = requestSignal(mockRequestTranscription.mock.calls[0]?.[1]);
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
    pending.resolve(transcription);
    await pending.promise;
  });

  it("aborts speech on tab teardown and never creates a late object URL", async () => {
    const user = userEvent.setup();
    const pending = deferred<{
      blob: Blob;
      fileName: string;
    }>();
    mockLoadDemoFiles.mockResolvedValue(sourceFiles);
    mockProcessSourceFiles.mockResolvedValue(demoProcessed);
    mockRunFixtureAnalysis.mockResolvedValue(demoResult);
    mockRequestSpeech.mockReturnValue(pending.promise);

    render(
      <LectureWeaver providers={configuredAudioProvider} />,
    );
    await user.click(screen.getByRole("button", { name: "Try the sample lecture" }));
    await screen.findByRole("heading", { name: "Enhanced notes" });
    await user.click(screen.getByRole("button", { name: "Audio guide" }));
    await user.click(screen.getByRole("button", { name: "Generate audio guide" }));

    const signal = requestSignal(mockRequestSpeech.mock.calls[0]?.[1]);
    expect(signal.aborted).toBe(false);
    await user.click(screen.getByRole("button", { name: "Enhanced notes" }));
    expect(signal.aborted).toBe(true);
    pending.resolve({
      blob: new Blob(["late audio"], { type: "audio/mpeg" }),
      fileName: "lectureweaver-study-guide.mp3",
    });
    await pending.promise;
    await Promise.resolve();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
});
