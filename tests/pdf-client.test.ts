import { beforeEach, describe, expect, it, vi } from "vitest";

const pdfJsMocks = vi.hoisted(() => ({
  cleanup: vi.fn(),
  destroy: vi.fn(async () => undefined),
  getDocument: vi.fn(),
  workerOptions: { workerSrc: "" },
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: pdfJsMocks.getDocument,
  GlobalWorkerOptions: pdfJsMocks.workerOptions,
}));

import { SourceProcessingError } from "@/lib/extraction";
import { extractPdfPages } from "@/lib/extraction/pdf.client";

describe("browser PDF extraction", () => {
  beforeEach(() => {
    pdfJsMocks.cleanup.mockReset();
    pdfJsMocks.destroy.mockClear();
    pdfJsMocks.getDocument.mockReset();
    pdfJsMocks.workerOptions.workerSrc = "";
  });

  it("uses the PDF.js compatibility build and preserves page locators", async () => {
    const getPage = vi.fn(async (pageNumber: number) => ({
      cleanup: pdfJsMocks.cleanup,
      getTextContent: vi.fn(async () => ({
        items: [
          {
            str: pageNumber === 1 ? "Retrieval" : "Spacing",
            hasEOL: false,
            transform: [1, 0, 0, 1, 0, 10],
          },
          {
            str: "practice",
            hasEOL: true,
            transform: [1, 0, 0, 1, 45, 10],
          },
        ],
      })),
    }));
    pdfJsMocks.getDocument.mockReturnValue({
      destroy: pdfJsMocks.destroy,
      promise: Promise.resolve({ getPage, numPages: 2 }),
    });

    await expect(
      extractPdfPages(
        new File(["%PDF-compatible"], "lecture.pdf", {
          type: "application/pdf",
        }),
      ),
    ).resolves.toEqual([
      { pageNumber: 1, text: "Retrieval practice" },
      { pageNumber: 2, text: "Spacing practice" },
    ]);

    expect(pdfJsMocks.workerOptions.workerSrc).toContain(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    );
    expect(getPage).toHaveBeenCalledTimes(2);
    expect(pdfJsMocks.cleanup).toHaveBeenCalledTimes(2);
    expect(pdfJsMocks.destroy).toHaveBeenCalledOnce();
  });

  it("cleans up the page and loading task when extraction fails", async () => {
    pdfJsMocks.getDocument.mockReturnValue({
      destroy: pdfJsMocks.destroy,
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn(async () => ({
          cleanup: pdfJsMocks.cleanup,
          getTextContent: vi.fn(async () => {
            throw new Error("worker text extraction failed");
          }),
        })),
      }),
    });

    await expect(
      extractPdfPages(
        new File(["%PDF-compatible"], "lecture.pdf", {
          type: "application/pdf",
        }),
      ),
    ).rejects.toBeInstanceOf(SourceProcessingError);

    expect(pdfJsMocks.cleanup).toHaveBeenCalledOnce();
    expect(pdfJsMocks.destroy).toHaveBeenCalledOnce();
  });

  it("does not discard extracted text when PDF.js cleanup fails", async () => {
    pdfJsMocks.cleanup.mockImplementationOnce(() => {
      throw new Error("page cleanup failed");
    });
    pdfJsMocks.destroy.mockRejectedValueOnce(new Error("worker teardown failed"));
    pdfJsMocks.getDocument.mockReturnValue({
      destroy: pdfJsMocks.destroy,
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn(async () => ({
          cleanup: pdfJsMocks.cleanup,
          getTextContent: vi.fn(async () => ({
            items: [
              {
                str: "Extracted before cleanup",
                hasEOL: true,
                transform: [1, 0, 0, 1, 0, 10],
              },
            ],
          })),
        })),
      }),
    });

    await expect(
      extractPdfPages(
        new File(["%PDF-compatible"], "lecture.pdf", {
          type: "application/pdf",
        }),
      ),
    ).resolves.toEqual([
      { pageNumber: 1, text: "Extracted before cleanup" },
    ]);
  });
});
