const ZERO_WIDTH_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/g;

export function normalizeSourceText(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .normalize("NFC")
    .replace(/\u00A0/g, " ")
    .replace(ZERO_WIDTH_CHARACTERS, "")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
export function normalizeChunkText(value: string): string {
  return normalizeSourceText(value).replace(/\n+/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function nonWhitespaceLength(value: string): number {
  return value.replace(/\s/g, "").length;
}
