import { randomUUID } from "node:crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import type {
  PdfPage,
  PdfChunk,
} from "../pdf/pdf-chunk.types.js";

interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
}

export async function createPdfChunks(
  documentId: string,
  pages: PdfPage[],
  options: ChunkOptions
): Promise<PdfChunk[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: options.chunkSize,
    chunkOverlap: options.chunkOverlap,
  });
  const chunks: PdfChunk[] = [];

  for (const page of pages) {
    const contents = await splitter.splitText(page.text);

    for (const content of contents) {
      if (!content.trim()) continue;

      chunks.push({
        id: randomUUID(),
        documentId,
        content,
        chunkIndex: chunks.length,
        pageStart: page.pageNumber,
        pageEnd: page.pageNumber,
        metadata: { extractionMethod: page.extractionMethod },
      });
    }
  }

  return chunks;
}
