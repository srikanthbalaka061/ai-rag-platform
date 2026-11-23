import { randomUUID } from "node:crypto";
import type {
  DocumentChunk,
  DocumentChunker as DocumentChunkerContract,
  ExtractedDocument,
} from "../core/ingestion.types.js";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

export class DocumentChunker implements DocumentChunkerContract {
  async chunk(document: ExtractedDocument): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];
    let start = 0;

    while (start < document.content.length) {
      const end = findChunkEnd(document.content, start);
      const content = document.content.slice(start, end).trim();

      if (content) {
        chunks.push({
          id: randomUUID(),
          documentId: document.documentId,
          content,
          chunkIndex: chunks.length,
          metadata: { ...document.metadata },
        });
      }

      if (end >= document.content.length) break;
      start = Math.max(start + 1, end - CHUNK_OVERLAP);
    }

    return chunks;
  }
}

function findChunkEnd(content: string, start: number): number {
  const maxEnd = Math.min(start + CHUNK_SIZE, content.length);
  if (maxEnd === content.length) return maxEnd;

  const window = content.slice(start, maxEnd);
  const paragraphBoundary = window.lastIndexOf("\n\n");
  if (paragraphBoundary >= CHUNK_SIZE / 2) {
    return start + paragraphBoundary;
  }

  const sentenceBoundary = Math.max(
    window.lastIndexOf(". "),
    window.lastIndexOf("? "),
    window.lastIndexOf("! ")
  );
  if (sentenceBoundary >= CHUNK_SIZE / 2) {
    return start + sentenceBoundary + 1;
  }

  const wordBoundary = window.lastIndexOf(" ");
  if (wordBoundary >= CHUNK_SIZE / 2) {
    return start + wordBoundary;
  }

  return maxEnd;
}
