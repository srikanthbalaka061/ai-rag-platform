import { qdrantClient } from "../../config/qdrant.js";
import { env } from "../../config/env.js";

import type {
  PdfEmbeddedChunk,
} from "../chunking/pdf/pdf-chunk.types.js";

export async function storePdfChunks(
  chunks: PdfEmbeddedChunk[],
  tenantId: string
): Promise<void> {
  const batchSize = 100;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    await qdrantClient.upsert(
      env.qdrantCollection,
      {
        wait: true,
        points: batch.map((chunk) => ({
          id: chunk.id,
          vector: chunk.vector,
          payload: {
            documentId: chunk.documentId,
            tenantId,
            content: chunk.content,
            chunkIndex: chunk.chunkIndex,
            pageStart: chunk.pageStart,
            pageEnd: chunk.pageEnd,
            ...chunk.metadata,
          },
        })),
      }
    );
  }
}