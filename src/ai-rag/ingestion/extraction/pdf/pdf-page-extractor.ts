import fs from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

import type { PdfPage } from "../../chunking/pdf/pdf-chunk.types.js";
import { extractScannedPdfPages } from "../ocr/scanned-pdf.service.js";

export async function extractPdfPages(
  filePath: string
): Promise<PdfPage[]> {
  const buffer = await fs.readFile(filePath);

  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;

  const pages: PdfPage[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);

      const content = await page.getTextContent();

      const text = content.items
        .filter((item) => "str" in item)
        .map((item) => item.str)
        .join(" ");

      pages.push({
        pageNumber,
        text,
        extractionMethod: "text",
      });

      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }

  return extractScannedPdfPages(buffer, pages);
}