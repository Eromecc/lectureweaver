import { describe, expect, it, vi } from "vitest";

import { MAX_AUDIO_FILE_BYTES } from "@/domain";
import {
  AudioClientError,
  requestAudioTranscription,
  requestStudyGuideSpeech,
  validateAudioFile,
} from "@/lib/ai/audio-client";

const transcriptionPayload = {
  model: "gpt-4o-transcribe-diarize",
  fileName: "lecture.mp3",
  text: "Speaker A: Retrieval is effortful.",
  durationSeconds: 3,
  segments: [
    {
      startSeconds: 0,
      endSeconds: 3,
      speaker: "Speaker A",
      text: "Retrieval is effortful.",
    },
  ],
};

describe("audio browser client", () => {
  it("validates supported audio metadata, signature, and the browser upload limit", async () => {
    await expect(
      validateAudioFile(
        new File([new Uint8Array([0x66, 0x4c, 0x61, 0x43])], "lecture.flac", {
          type: "audio/flac",
        }),
      ),
    ).resolves.toBeUndefined();
    await expect(
      validateAudioFile(new File(["audio"], "lecture.aac", { type: "audio/aac" })),
    ).rejects.toThrow(/supported audio file/);
    await expect(
      validateAudioFile(
        new File([new Uint8Array([0x49, 0x44, 0x33])], "lecture.mp3", {
          type: "",
        }),
      ),
    ).rejects.toThrow(/unsupported audio content type/);
    await expect(
      validateAudioFile(
        new File([new Uint8Array([0x49, 0x44, 0x33])], "lecture.wav", {
          type: "audio/wav",
        }),
      ),
    ).rejects.toThrow(/signature do not agree/);
    await expect(
      validateAudioFile(
        new File([new Uint8Array(MAX_AUDIO_FILE_BYTES + 1)], "lecture.wav", {
          type: "audio/wav",
        }),
      ),
    ).rejects.toThrow(/4 MB audio upload limit/);
  });

  it("posts multipart audio without setting a browser Content-Type and validates success", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(transcriptionPayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const file = new File([new Uint8Array([0x49, 0x44, 0x33])], "lecture.mp3", {
      type: "audio/mpeg",
    });
    const controller = new AbortController();

    await expect(
      requestAudioTranscription(file, {
        fetchImpl,
        signal: controller.signal,
      }),
    ).resolves.toEqual(transcriptionPayload);
    const request = fetchImpl.mock.calls[0]?.[1];
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/transcribe",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
    expect(request?.headers).toBeUndefined();
    expect(request?.body).toBeInstanceOf(FormData);
    expect(request?.signal).toBe(controller.signal);
    const formData = request?.body as FormData;
    expect(formData.get("audio")).toBeInstanceOf(File);
    expect(formData.get("credentialMode")).toBe("deployment");
  });

  it("sends an explicitly supplied temporary credential only in the request header", async () => {
    const credential = "sk-temporary-audio-123456";
    const transcriptionFetch = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json(transcriptionPayload),
    );
    const file = new File(
      [new Uint8Array([0x49, 0x44, 0x33])],
      "lecture.mp3",
      { type: "audio/mpeg" },
    );

    await requestAudioTranscription(file, {
      fetchImpl: transcriptionFetch,
      sessionApiKey: credential,
    });

    const transcriptionInit = transcriptionFetch.mock.calls[0]?.[1];
    expect(
      new Headers(transcriptionInit?.headers).get(
        "x-lectureweaver-provider-key",
      ),
    ).toBe(credential);
    const transcriptionBody = transcriptionInit?.body as FormData;
    expect(transcriptionBody.get("credentialMode")).toBe("session");
    expect([...transcriptionBody.values()]).not.toContain(credential);

    const speechFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );
    await requestStudyGuideSpeech(
      {
        text: "Review retrieval practice.",
        voice: "marin",
        format: "mp3",
      },
      { fetchImpl: speechFetch, sessionApiKey: credential },
    );

    const speechInit = speechFetch.mock.calls[0]?.[1];
    expect(
      new Headers(speechInit?.headers).get(
        "x-lectureweaver-provider-key",
      ),
    ).toBe(credential);
    const speechBody = JSON.parse(String(speechInit?.body)) as unknown;
    expect(speechBody).toEqual({
      text: "Review retrieval practice.",
      voice: "marin",
      format: "mp3",
      credentialMode: "session",
    });
    expect(String(speechInit?.body)).not.toContain(credential);
  });

  it("rejects an invalid temporary credential before making an audio request", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const file = new File(
      [new Uint8Array([0x49, 0x44, 0x33])],
      "lecture.mp3",
      { type: "audio/mpeg" },
    );

    await expect(
      requestAudioTranscription(file, {
        fetchImpl,
        sessionApiKey: "bad\ncredential",
      }),
    ).rejects.toMatchObject({
      code: "invalid_request",
      retryable: false,
    });
    await expect(
      requestStudyGuideSpeech(
        {
          text: "Review retrieval practice.",
          voice: "marin",
          format: "mp3",
        },
        { fetchImpl, sessionApiKey: "short" },
      ),
    ).rejects.toMatchObject({
      code: "invalid_request",
      retryable: false,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps stable server errors and rejects malformed transcription output", async () => {
    const rateLimited = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "rate_limited",
            message: "OpenAI is rate-limiting transcription requests.",
            retryable: true,
          },
        }),
        { status: 429 },
      ),
    );
    const file = new File([new Uint8Array([0x49, 0x44, 0x33])], "lecture.mp3", {
      type: "audio/mpeg",
    });

    await expect(requestAudioTranscription(file, rateLimited)).rejects.toMatchObject({
      code: "rate_limited",
      retryable: true,
    });

    const malformedPayloads = [
      { ...transcriptionPayload, segments: [] },
      { ...transcriptionPayload, fileName: "../lecture.mp3" },
      {
        ...transcriptionPayload,
        text: "Unrelated top-level text not derived from the timestamped segments.",
      },
    ];
    for (const payload of malformedPayloads) {
      const malformed = vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify(payload), { status: 200 }),
      );
      await expect(
        requestAudioTranscription(file, malformed),
      ).rejects.toMatchObject({
        code: "provider_invalid_output",
        retryable: true,
      });
    }
  });

  it("posts a strict speech request and returns only the expected audio format", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );

    const speech = await requestStudyGuideSpeech(
      { text: "Retrieval practice strengthens recall.", voice: "marin", format: "mp3" },
      fetchImpl,
    );
    expect(speech.fileName).toBe("lectureweaver-study-guide.mp3");
    expect(speech.blob.size).toBe(3);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toEqual({
      text: "Retrieval practice strengthens recall.",
      voice: "marin",
      format: "mp3",
      credentialMode: "deployment",
    });

    const wrongType = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      }),
    );
    await expect(
      requestStudyGuideSpeech(
        { text: "Review the concept.", voice: "cedar", format: "wav" },
        wrongType,
      ),
    ).rejects.toBeInstanceOf(AudioClientError);
  });

  it("maps an unreadable speech stream to a stable retryable error", async () => {
    const response = new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    });
    vi.spyOn(response, "blob").mockRejectedValue(
      new TypeError("raw browser stream failure"),
    );
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(
      requestStudyGuideSpeech(
        { text: "Review retrieval practice.", voice: "marin", format: "mp3" },
        fetchImpl,
      ),
    ).rejects.toMatchObject({
      code: "provider_error",
      message: "The generated audio stream could not be read. Please retry.",
      retryable: true,
    });
  });
});
