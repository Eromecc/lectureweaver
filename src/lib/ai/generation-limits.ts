import type { AnalysisOutputOptions } from "@/domain";

// Keep the one-shot study-pack response large enough for a useful guide while
// preventing optional cards from turning a normal analysis into an unbounded
// non-streaming completion.
export const MAX_MODEL_OUTPUT_TOKENS_WITHOUT_ANKI = 8_000;
export const MAX_MODEL_OUTPUT_TOKENS_WITH_ANKI = 10_000;

export function modelOutputTokenLimit(
  outputs: AnalysisOutputOptions,
): number {
  return outputs.ankiCards
    ? MAX_MODEL_OUTPUT_TOKENS_WITH_ANKI
    : MAX_MODEL_OUTPUT_TOKENS_WITHOUT_ANKI;
}
