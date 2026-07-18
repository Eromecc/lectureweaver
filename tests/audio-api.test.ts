// @vitest-environment node

import OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as speechPost } from "@/app/api/speech/route";
import { POST as transcribePost } from "@/app/api/transcribe/route";
import {
  AUDIO_FILE_EXTENSIONS,
  AUDIO_SPEECH_FORMATS,
  AUDIO_VOICES,
  AudioErrorSchema,
  AudioTranscriptionSuccessSchema,
  MAX_AUDIO_FILE_BYTES,
  SpeechRequestSchema,
} from "@/domain";
import {
  AudioRequestError,
  createSpeechWithOpenAI,
  invokeOpenAISpeech,
  transcribeAudioWithOpenAI,
  validateAudioUpload,
} from "@/lib/ai/audio";

const WAV_HEADER = new Uint8Array([
  0x52,
  0x49,
  0x46,
  0x46,
  0x04,
  0x00,
  0x00,
  0x00,
  0x57,
  0x41,
  0x56,
  0x45,
]);

const AUDIO_FILE_CASES = [
  {
    name: "lecture.flac",
    type: "audio/flac",
    bytes: new Uint8Array([0x66, 0x4c, 0x61, 0x43]),
  },
  {
    name: "lecture.mp3",
    type: "audio/mpeg",
    bytes: new Uint8Array([0x49, 0x44, 0x33, 0x04]),
  },
  {
    name: "lecture.mp4",
    type: "video/mp4",
    bytes: new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
  },
  {
    name: "lecture.mpeg",
    type: "video/mpeg",
    bytes: new Uint8Array([0x00, 0x00, 0x01, 0xba]),
  },
  {
    name: "lecture.mpga",
    type: "audio/mpeg",
    bytes: new Uint8Array([0xff, 0xfb, 0x90, 0x64]),
  },
  {
    name: "lecture.m4a",
    type: "audio/x-m4a",
    bytes: new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
  },
  {
    name: "lecture.ogg",
    type: "audio/ogg",
    bytes: new Uint8Array([0x4f, 0x67, 0x67, 0x53]),
  },
  { name: "lecture.wav", type: "audio/wav", bytes: WAV_HEADER },
  {
    name: "lecture.webm",
    type: "audio/webm",
    bytes: new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]),
  },
] as const;

function wavFile(type = "audio/wav", name = "lecture.wav"): File {
  return new File([WAV_HEADER], name, { type });
}

async function multipartRequest(file: File, language?: string): Promise<Request> {
  const boundary = "lectureweaver-test-boundary";
  const encoder = new TextEncoder();
  const audio = new Uint8Array(await file.arrayBuffer());
  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="audio"; filename="${file.name}"\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
  );
  const languagePart =
    language === undefined
      ? new Uint8Array()
      : encoder.encode(
          `\r\n--${boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\n${language}`,
        );
  const suffix = encoder.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(
    prefix.byteLength + audio.byteLength + languagePart.byteLength + suffix.byteLength,
  );
  body.set(prefix, 0);
  body.set(audio, prefix.byteLength);
  body.set(languagePart, prefix.byteLength + audio.byteLength);
  body.set(suffix, prefix.byteLength + audio.byteLength + languagePart.byteLength);
  return new Request("http://localhost/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
    body: body.buffer,
  });
}

function speechRequest(body: unknown): Request {
  return new Request("http://localhost/api/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function providerTranscript(): unknown {
  return {
    task: "transcribe",
    duration: 3,
    text: "This top-level text is deliberately not trusted.",
    segments: [
      {
        type: "transcript.text.segment",
        id: "provider-segment-1",
        start: 0,
        end: 1.25,
        speaker: "A",
        text: "  Retrieval   practice works. ",
      },
      {
        type: "transcript.text.segment",
        id: "provider-segment-2",
        start: 1.25,
        end: 3,
        speaker: "B",
        text: "Spacing makes it durable.",
      },
    ],
  };
}

function chunkedAudioResponse(chunks: readonly Uint8Array[]): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(chunk));
        controller.close();
      },
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("audio domain and upload validation", () => {
  it("publishes finite extension, voice, and export-format allowlists", () => {
    expect(AUDIO_FILE_EXTENSIONS).toEqual([
      ".flac",
      ".mp3",
      ".mp4",
      ".mpeg",
      ".mpga",
      ".m4a",
      ".ogg",
      ".wav",
      ".webm",
    ]);
    expect(AUDIO_VOICES).toContain("marin");
    expect(AUDIO_SPEECH_FORMATS).toEqual(["mp3", "wav"]);
    expect(
      SpeechRequestSchema.safeParse({
        text: "x".repeat(4_097),
        voice: "marin",
        format: "mp3",
      }).success,
    ).toBe(false);
    expect(
      SpeechRequestSchema.safeParse({
        text: "Study this.",
        voice: "custom-voice-id",
        format: "opus",
      }).success,
    ).toBe(false);
  });

  it("rejects overlapping or out-of-duration transcript segments", () => {
    expect(
      AudioTranscriptionSuccessSchema.safeParse({
        model: "gpt-4o-transcribe-diarize",
        fileName: "lecture.wav",
        text: "A transcript",
        durationSeconds: 2,
        segments: [
          { startSeconds: 0, endSeconds: 1.5, speaker: "A", text: "First" },
          { startSeconds: 1, endSeconds: 2.1, speaker: "B", text: "Second" },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects unsafe file names and transcript text that diverges from segments", () => {
    const valid = {
      model: "gpt-4o-transcribe-diarize",
      fileName: "lecture.MP3",
      text: "Speaker A: Retrieval practice works.",
      durationSeconds: 2,
      segments: [
        {
          startSeconds: 0,
          endSeconds: 2,
          speaker: "Speaker A",
          text: "Retrieval practice works.",
        },
      ],
    };
    expect(AudioTranscriptionSuccessSchema.safeParse(valid).success).toBe(true);

    for (const fileName of [
      "../lecture.mp3",
      "folder\\lecture.wav",
      "lecture.mp3\n",
      "lecture.exe",
      "lecture",
    ]) {
      expect(
        AudioTranscriptionSuccessSchema.safeParse({ ...valid, fileName }).success,
      ).toBe(false);
    }
    expect(
      AudioTranscriptionSuccessSchema.safeParse({
        ...valid,
        text: "This unrelated text did not come from the segments.",
      }).success,
    ).toBe(false);
    expect(
      AudioTranscriptionSuccessSchema.safeParse({
        ...valid,
        segments: [{ ...valid.segments[0], speaker: "A" }],
      }).success,
    ).toBe(false);
  });

  it("requires an explicit MIME that agrees with extension and signature", async () => {
    await expect(validateAudioUpload(wavFile(""))).rejects.toMatchObject({
      code: "invalid_request",
      status: 415,
    });
    await expect(
      validateAudioUpload(wavFile("audio/mpeg")),
    ).rejects.toMatchObject({ code: "invalid_request", status: 415 });
    await expect(
      validateAudioUpload(new File(["not audio"], "lecture.wav", { type: "audio/wav" })),
    ).rejects.toMatchObject({ code: "invalid_request", status: 415 });
  });

  it.each(AUDIO_FILE_CASES)(
    "accepts the allowlisted $name signature and MIME family",
    async ({ bytes, name, type }) => {
      await expect(
        validateAudioUpload(new File([bytes], name, { type })),
      ).resolves.toMatchObject({ fileName: name, mimeType: type });
    },
  );

  it.each(AUDIO_FILE_CASES)(
    "rejects MIME and signature mismatches for $name",
    async ({ bytes, name, type }) => {
      const mismatchedMime = type === "audio/wav" ? "audio/mpeg" : "audio/wav";
      const mismatchedSignature =
        type === "audio/wav"
          ? new Uint8Array([0x49, 0x44, 0x33, 0x04])
          : WAV_HEADER;

      await expect(
        validateAudioUpload(new File([bytes], name, { type: mismatchedMime })),
      ).rejects.toMatchObject({ code: "invalid_request", status: 415 });
      await expect(
        validateAudioUpload(new File([mismatchedSignature], name, { type })),
      ).rejects.toMatchObject({ code: "invalid_request", status: 415 });
    },
  );

  it("rejects empty and oversized audio before provider work", async () => {
    await expect(
      validateAudioUpload(new File([], "empty.wav", { type: "audio/wav" })),
    ).rejects.toBeInstanceOf(AudioRequestError);
    await expect(
      validateAudioUpload(
        new File([new Uint8Array(MAX_AUDIO_FILE_BYTES + 1)], "large.wav", {
          type: "audio/wav",
        }),
      ),
    ).rejects.toMatchObject({ code: "request_too_large", status: 413 });
  });
});

describe("OpenAI audio helpers", () => {
  it("derives normalized transcript text from validated segments", async () => {
    const upload = await validateAudioUpload(wavFile());
    const invoke = vi.fn(async () => providerTranscript());
    const abortController = new AbortController();
    const result = await transcribeAudioWithOpenAI(
      upload,
      "zh",
      { OPENAI_API_KEY: "fake-test-key" },
      invoke,
      abortController.signal,
    );

    expect(result).toEqual({
      model: "gpt-4o-transcribe-diarize",
      fileName: "lecture.wav",
      text:
        "Speaker A: Retrieval practice works.\n\nSpeaker B: Spacing makes it durable.",
      durationSeconds: 3,
      segments: [
        {
          startSeconds: 0,
          endSeconds: 1.25,
          speaker: "Speaker A",
          text: "Retrieval practice works.",
        },
        {
          startSeconds: 1.25,
          endSeconds: 3,
          speaker: "Speaker B",
          text: "Spacing makes it durable.",
        },
      ],
    });
    expect(result.segments[0]).not.toHaveProperty("id");
    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "fake-test-key",
        model: "gpt-4o-transcribe-diarize",
        language: "zh",
        signal: abortController.signal,
      }),
    );
  });

  it("fails closed for missing keys, bad deployment models, and malformed segments", async () => {
    const upload = await validateAudioUpload(wavFile());
    const invoke = vi.fn(async () => providerTranscript());

    await expect(
      transcribeAudioWithOpenAI(upload, undefined, {}, invoke),
    ).rejects.toMatchObject({ code: "provider_not_configured" });
    await expect(
      transcribeAudioWithOpenAI(
        upload,
        undefined,
        {
          OPENAI_API_KEY: "fake-test-key",
          OPENAI_TRANSCRIBE_MODEL: "arbitrary-model",
        },
        invoke,
      ),
    ).rejects.toMatchObject({ code: "unsupported_model" });
    expect(invoke).not.toHaveBeenCalled();

    await expect(
      transcribeAudioWithOpenAI(
        upload,
        undefined,
        { OPENAI_API_KEY: "fake-test-key" },
        async () => ({
          duration: 2,
          segments: [
            { start: 0, end: 1.5, speaker: "A", text: "First" },
            { start: 1, end: 2, speaker: "B", text: "Overlap" },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: "provider_invalid_output" });
  });

  it("maps mocked timeout and balance errors without exposing upstream details", async () => {
    const upload = await validateAudioUpload(wavFile());
    await expect(
      transcribeAudioWithOpenAI(
        upload,
        undefined,
        { OPENAI_API_KEY: "fake-test-key" },
        async () => {
          throw new OpenAI.APIConnectionTimeoutError();
        },
      ),
    ).rejects.toMatchObject({
      code: "provider_timeout",
      status: 504,
      retryable: true,
    });

    const balanceError = OpenAI.APIError.generate(
      429,
      {
        error: {
          code: "insufficient_quota",
          type: "insufficient_quota",
          message: "private provider balance detail",
        },
      },
      undefined,
      new Headers(),
    );
    await expect(
      transcribeAudioWithOpenAI(
        upload,
        undefined,
        { OPENAI_API_KEY: "fake-test-key" },
        async () => {
          throw balanceError;
        },
      ),
    ).rejects.toMatchObject({
      code: "provider_balance",
      status: 503,
      retryable: false,
    });
  });

  it("returns an unbuffered speech response and validates its deployment model", async () => {
    const invoke = vi.fn(async () =>
      new Response(new Uint8Array([0x49, 0x44, 0x33]), {
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );
    const request = SpeechRequestSchema.parse({
      text: "Review retrieval practice.",
      voice: "marin",
      format: "mp3",
    });
    const abortController = new AbortController();
    const speech = await createSpeechWithOpenAI(
      request,
      { OPENAI_API_KEY: "fake-test-key" },
      invoke,
      abortController.signal,
    );

    expect(speech.model).toBe("gpt-4o-mini-tts");
    expect(speech.response.body).toBeInstanceOf(ReadableStream);
    expect(invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "fake-test-key",
        model: "gpt-4o-mini-tts",
        request,
        signal: abortController.signal,
      }),
    );

    await expect(
      createSpeechWithOpenAI(
        request,
        {
          OPENAI_API_KEY: "fake-test-key",
          OPENAI_TTS_MODEL: "untrusted-tts-model",
        },
        invoke,
      ),
    ).rejects.toMatchObject({ code: "unsupported_model" });
  });

  it("validates split MP3 and WAV prefixes without buffering the remainder", async () => {
    const request = SpeechRequestSchema.parse({
      text: "Review this.",
      voice: "marin",
      format: "mp3",
    });
    const mp3Chunks = [
      new Uint8Array([0x49]),
      new Uint8Array([0x44]),
      new Uint8Array([0x33, 0x04, 0xaa]),
      new Uint8Array([0xbb, 0xcc]),
    ];
    const mp3 = await createSpeechWithOpenAI(
      request,
      { OPENAI_API_KEY: "fake-test-key" },
      async () => chunkedAudioResponse(mp3Chunks),
    );
    expect(new Uint8Array(await mp3.response.arrayBuffer())).toEqual(
      new Uint8Array([0x49, 0x44, 0x33, 0x04, 0xaa, 0xbb, 0xcc]),
    );

    const wavRequest = SpeechRequestSchema.parse({
      text: "Review this.",
      voice: "cedar",
      format: "wav",
    });
    const wavChunks = [
      new Uint8Array([0x52, 0x49]),
      new Uint8Array([0x46, 0x46, 0x04, 0x00]),
      new Uint8Array([0x00, 0x00, 0x57]),
      new Uint8Array([0x41, 0x56, 0x45, 0xdd]),
      new Uint8Array([0xee]),
    ];
    const wav = await createSpeechWithOpenAI(
      wavRequest,
      { OPENAI_API_KEY: "fake-test-key" },
      async () => chunkedAudioResponse(wavChunks),
    );
    expect(new Uint8Array(await wav.response.arrayBuffer())).toEqual(
      new Uint8Array([
        0x52,
        0x49,
        0x46,
        0x46,
        0x04,
        0x00,
        0x00,
        0x00,
        0x57,
        0x41,
        0x56,
        0x45,
        0xdd,
        0xee,
      ]),
    );
  });

  it("rejects empty, short, or bogus successful upstream audio", async () => {
    const request = SpeechRequestSchema.parse({
      text: "Review this.",
      voice: "marin",
      format: "mp3",
    });
    const responses = [
      new Response(),
      chunkedAudioResponse([new Uint8Array([0x49, 0x44])]),
      chunkedAudioResponse([new Uint8Array([0x7b, 0x22, 0x65, 0x72])]),
    ];

    for (const response of responses) {
      await expect(
        createSpeechWithOpenAI(
          request,
          { OPENAI_API_KEY: "fake-test-key" },
          async () => response,
        ),
      ).rejects.toMatchObject({
        code: "provider_invalid_output",
        status: 502,
      });
    }
  });

  it("uses the configured fetch implementation in the SDK speech invocation", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(new Uint8Array([0x49, 0x44, 0x33])),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await invokeOpenAISpeech({
      apiKey: "fake-test-key",
      model: "gpt-4o-mini-tts",
      request: {
        text: "Review this.",
        voice: "marin",
        format: "mp3",
      },
    });

    expect(response).toBeInstanceOf(Response);
    expect(
      fetchMock.mock.calls.map(([input]) =>
        typeof input === "string" || input instanceof URL ? String(input) : input.url,
      ),
    ).toEqual(["https://api.openai.com/v1/audio/speech"]);
  });
});

describe("audio API routes", () => {
  it("transcribes multipart audio through a fully mocked OpenAI request", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fake-route-key");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(providerTranscript()),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await transcribePost(await multipartRequest(wavFile(), "ZH"));
    const responseText = await response.text();
    expect(response.status, responseText).toBe(200);
    const payload = AudioTranscriptionSuccessSchema.parse(
      JSON.parse(responseText) as unknown,
    );

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.text).toContain("Speaker A: Retrieval practice works.");
    expect(
      fetchMock.mock.calls.map(([input, init]) => ({
        url:
          typeof input === "string" || input instanceof URL
            ? String(input)
            : input.url,
        method:
          input instanceof Request
            ? input.method
            : typeof init?.method === "string"
              ? init.method
              : "GET",
      })),
    ).toEqual([
      { url: "data:,", method: "GET" },
      {
        url: "https://api.openai.com/v1/audio/transcriptions",
        method: "POST",
      },
    ]);
  });

  it("rejects invalid uploads without calling OpenAI", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fake-route-key");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    const response = await transcribePost(
      await multipartRequest(
        new File(["fake"], "lecture.wav", { type: "audio/wav" }),
      ),
    );
    const payload = AudioErrorSchema.parse(
      JSON.parse(await response.text()) as unknown,
    );

    expect(response.status, JSON.stringify(payload)).toBe(415);
    expect(payload.error.code).toBe("invalid_request");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("streams trusted MP3 headers from a mocked speech response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fake-route-key");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(new Uint8Array([0x49, 0x44, 0x33, 0x04]), {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await speechPost(
      speechRequest({
        text: "Review retrieval practice.",
        voice: "marin",
        format: "mp3",
      }),
    );

    expect(response.status, await response.clone().text()).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="lectureweaver-study-audio.mp3"',
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([0x49, 0x44, 0x33, 0x04]),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects a successful bogus speech body with the stable error envelope", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fake-route-key");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(new TextEncoder().encode('{"error":"not audio"}'), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await speechPost(
      speechRequest({ text: "Study.", voice: "cedar", format: "wav" }),
    );
    const payload = AudioErrorSchema.parse(
      JSON.parse(await response.text()) as unknown,
    );

    expect(response.status).toBe(502);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.error).toMatchObject({
      code: "provider_invalid_output",
      retryable: true,
    });
  });

  it("uses the stable error envelope and never exposes credentials", async () => {
    vi.stubEnv("OPENAI_API_KEY", "fake-private-route-key");
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response("private provider detail", { status: 401 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await speechPost(
      speechRequest({ text: "Study.", voice: "cedar", format: "wav" }),
    );
    const responseText = await response.text();
    const payload = AudioErrorSchema.parse(JSON.parse(responseText) as unknown);

    expect(response.status, responseText).toBe(503);
    expect(payload.error).toMatchObject({
      code: "provider_auth",
      retryable: false,
    });
    expect(responseText).not.toContain("private provider detail");
    expect(responseText).not.toContain("fake-private-route-key");
  });
});
