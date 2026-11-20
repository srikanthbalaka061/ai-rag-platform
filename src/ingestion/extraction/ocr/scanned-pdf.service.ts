import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PdfPage } from "../../chunking/pdf/pdf-chunk.types.js";
import { withOcrWorker } from "./pdf-ocr.service.js";

const nodeRequire = createRequire(__filename);
const pdfJsEntry = nodeRequire.resolve("pdfjs-dist/legacy/build/pdf.mjs");
const wasmUrl = `${resolve(dirname(pdfJsEntry), "../../wasm").replace(/\\/g, "/")}/`;

export async function extractScannedPdfPages(
  fileBuffer: Uint8Array,
  pages: PdfPage[],
): Promise<PdfPage[]> {
  const pagesNeedingOcr = new Set(
    pages.filter((page) => !page.text.trim()).map((page) => page.pageNumber),
  );

  if (pagesNeedingOcr.size === 0) {
    return pages;
  }

  const loadingTask = getDocument({
    data: new Uint8Array(fileBuffer),
    wasmUrl,
    useWorkerFetch: false,
  });

  try {
    const pdf = await loadingTask.promise;
    const ocrText = new Map<number, string>();

    await withOcrWorker(async (recognize) => {
      for (const pageNumber of pagesNeedingOcr) {
        const page = await pdf.getPage(pageNumber);

        try {
          const viewport = page.getViewport({ scale: 2 });
          const canvas = createCanvas(
            Math.ceil(viewport.width),
            Math.ceil(viewport.height),
          );
          await page.render({
            canvasContext: canvas.getContext("2d") as unknown as CanvasRenderingContext2D,
            canvas: null,
            viewport,
          }).promise;
          ocrText.set(pageNumber, await recognize(canvas.toBuffer("image/png")));
        } finally {
          page.cleanup();
        }
      }
    });

    return pages.map((page) => {
      const text = ocrText.get(page.pageNumber);
      return text === undefined
        ? page
        : { ...page, text, extractionMethod: "ocr" };
    });
  } finally {
    await loadingTask.destroy();
  }
}