import { MAX_PDF_PAGES } from "./constants";
import { SourceProcessingError } from "./errors";
import { normalizeSourceText } from "./normalize";
import type { PdfPageText } from "./chunking";

type PdfTextItem = {
  str: string;
  hasEOL: boolean;
  transform: number[];
};

function isPdfTextItem(value: unknown): value is PdfTextItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "str" in value &&
    typeof value.str === "string" &&
    "transform" in value &&
    Array.isArray(value.transform)
  );
}

function textItemsToLines(items: unknown[]): string {
  const lines: string[] = [];
  let currentLine: string[] = [];
  let lastY: number | null = null;

  const flush = () => {
    const line = currentLine.join(" ").replace(/\s{2,}/g, " ").trim();
    currentLine = [];
    if (line) lines.push(line);
  };

  for (const item of items) {
    if (!isPdfTextItem(item) || !item.str.trim()) continue;
    const y: number = item.transform[5] ?? lastY ?? 0;
    if (lastY !== null && Math.abs(y - lastY) > 4) flush();
    currentLine.push(item.str.trim());
    lastY = y;
    if (item.hasEOL) flush();
  }
  flush();
  return normalizeSourceText(lines.join("\n"));
}

export async function extractPdfPages(file: File): Promise<PdfPageText[]> {
  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();

    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    const document = await loadingTask.promise;
    if (document.numPages > MAX_PDF_PAGES) {
      await loadingTask.destroy();
      throw new SourceProcessingError(
        "too_many_pages",
        "slides",
        `The PDF has more than the ${MAX_PDF_PAGES}-page demo limit.`,
      );
    }

    const pages: PdfPageText[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push({ pageNumber, text: textItemsToLines(content.items) });
      page.cleanup();
    }
    await loadingTask.destroy();
    return pages;
  } catch (error: unknown) {
    if (error instanceof SourceProcessingError) throw error;
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("password")) {
      throw new SourceProcessingError(
        "encrypted_pdf",
        "slides",
        "Password-protected PDFs are not supported in this demo.",
      );
    }
    throw new SourceProcessingError(
      "invalid_pdf",
      "slides",
      "This PDF passed the basic file checks, but its pages could not be extracted. Re-export it as a text-based PDF, or switch to lecture TXT or pasted text.",
    );
  }
}
