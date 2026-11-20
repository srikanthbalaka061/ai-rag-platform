import { randomUUID } from "node:crypto";

import type {
  PdfPage,
  PdfChunk,
} from "../pdf/pdf-chunk.types.js";

interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
}

export function createPdfChunks(
  documentId: string,
  pages: PdfPage[],
  options: ChunkOptions
): PdfChunk[] {
  const chunks: PdfChunk[] = [];

  let currentText = "";
  let pageStart = 1;
  let pageEnd = 1;
  let chunkIndex = 0;

  const flush = () => {
    const content = currentText.trim();

    if (!content) return;

    chunks.push({
      id: randomUUID(),
      documentId,
      content,
      chunkIndex: chunkIndex++,
      pageStart,
      pageEnd,
      metadata: {},
    });

    const overlap = content.slice(-options.chunkOverlap);

    currentText = overlap;
    pageStart = pageEnd;
  };

  for (const page of pages) {
    const text = page.text.trim();

    if (!text) continue;

    const paragraphs = text.split(/\n\s*\n/);

    for (const paragraph of paragraphs) {
      const value = paragraph.trim();

      if (!value) continue;

      if (
        currentText.length + value.length >
        options.chunkSize
      ) {
        flush();
      }

      if (value.length > options.chunkSize) {
        let remaining = value;

        while (remaining.length > options.chunkSize) {
          const part = remaining.slice(0, options.chunkSize);

          currentText += part;
          pageEnd = page.pageNumber;
          flush();

          remaining = remaining.slice(
            options.chunkSize - options.chunkOverlap
          );
        }

        currentText += remaining + "\n\n";
      } else {
        currentText += value + "\n\n";
      }

      pageEnd = page.pageNumber;
    }
  }

  flush();

  return chunks;
}