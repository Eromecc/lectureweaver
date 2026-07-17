import { normalizeSourceText } from "./normalize";

export type MarkdownBlock = {
  ordinal: number;
  text: string;
  headingPath: string[];
};

type HeadingEntry = {
  level: number;
  title: string;
};

type FenceState = {
  marker: "`" | "~";
  length: number;
};

const ATX_HEADING = /^\s{0,3}(#{1,6})(?:[\t ]+(.*)|[\t ]*)$/;
const SETEXT_HEADING = /^\s{0,3}(=+|-+)\s*$/;
const FENCE = /^\s{0,3}(`{3,}|~{3,})(.*)$/;

function atxTitle(rawTitle: string): string {
  return rawTitle.replace(/[\t ]+#+[\t ]*$/, "").trim();
}

function updateHeadingStack(
  stack: HeadingEntry[],
  level: number,
  title: string,
): HeadingEntry[] {
  return [...stack.filter((entry) => entry.level < level), { level, title }];
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = normalizeSourceText(markdown).split("\n");
  const blocks: MarkdownBlock[] = [];
  let headingStack: HeadingEntry[] = [];
  let buffer: string[] = [];
  let fence: FenceState | null = null;

  const flush = () => {
    const text = buffer.join("\n").trim();
    buffer = [];
    if (!text) return;
    blocks.push({
      ordinal: blocks.length + 1,
      text,
      headingPath: headingStack.map((entry) => entry.title),
    });
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const fenceMatch = line.match(FENCE);
    const fenceRun = fenceMatch?.[1];
    const marker = fenceRun?.[0];

    if (fence !== null) {
      if (
        (marker === "`" || marker === "~") &&
        marker === fence.marker &&
        (fenceRun?.length ?? 0) >= fence.length &&
        !(fenceMatch?.[2] ?? "").trim()
      ) {
        fence = null;
      }
      buffer.push(line);
      continue;
    }

    if ((marker === "`" || marker === "~") && fenceRun) {
      fence = { marker, length: fenceRun.length };
      buffer.push(line);
      continue;
    }

    {
      const atxMatch = line.match(ATX_HEADING);
      if (atxMatch) {
        flush();
        const level = atxMatch[1]?.length ?? 1;
        const title = atxTitle(atxMatch[2] ?? "");
        headingStack = title
          ? updateHeadingStack(headingStack, level, title)
          : headingStack.filter((entry) => entry.level < level);
        continue;
      }

      const nextLine = lines[index + 1] ?? "";
      const setextMatch = nextLine.match(SETEXT_HEADING);
      if (line.trim() && setextMatch) {
        flush();
        const marker = setextMatch[1]?.[0];
        const level = marker === "=" ? 1 : 2;
        headingStack = updateHeadingStack(headingStack, level, line.trim());
        index += 1;
        continue;
      }

      if (!line.trim()) {
        flush();
        continue;
      }
    }

    buffer.push(line);
  }

  flush();
  return blocks;
}
