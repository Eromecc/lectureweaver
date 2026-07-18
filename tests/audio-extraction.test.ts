import {
  chunkTimestampedTranscript,
  type TimestampedTranscriptSegment,
} from "@/lib/extraction";
import { describe, expect, it } from "vitest";

describe("timestamped transcript chunking", () => {
  const firstSegment: TimestampedTranscriptSegment =
    {
      startSeconds: 12.25,
      endSeconds: 18.1,
      speaker: "A",
      text: "Retrieval practice strengthens access to a memory.",
    };
  const segments: TimestampedTranscriptSegment[] = [
    firstSegment,
    {
      startSeconds: 18.1,
      endSeconds: 65.01,
      speaker: "B",
      text: "Spacing changes when that retrieval happens.",
    },
  ];

  it("derives stable ids, trusted time locators, and speaker-labelled text", () => {
    expect(chunkTimestampedTranscript(segments, "lecture.mp3")).toEqual([
      {
        id: "transcript:t000012250-t000065010:c01",
        sourceType: "transcript",
        sourceName: "lecture.mp3",
        locator: "00:12–01:06",
        text:
          "Speaker A: Retrieval practice strengthens access to a memory. Speaker B: Spacing changes when that retrieval happens.",
      },
    ]);
  });

  it("splits oversized speech without losing its time range", () => {
    const chunks = chunkTimestampedTranscript(
      [{ ...firstSegment, text: "alpha beta gamma delta" }],
      "lecture.webm",
      12,
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.locator === "00:12–00:19")).toBe(true);
    expect(chunks.every((chunk) => chunk.text.length <= 12)).toBe(true);
    expect(chunks.every((chunk) => chunk.text.startsWith("Speaker A: "))).toBe(true);
    expect(new Set(chunks.map((chunk) => chunk.id)).size).toBe(chunks.length);
  });

  it("uses hour-aware locators", () => {
    const [chunk] = chunkTimestampedTranscript(
      [{ ...firstSegment, startSeconds: 3_661.2, endSeconds: 3_666.1 }],
      "long-lecture.m4a",
    );

    expect(chunk?.locator).toBe("01:01:01–01:01:07");
  });
});
