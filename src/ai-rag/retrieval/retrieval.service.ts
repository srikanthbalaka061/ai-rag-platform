import { qdrantClient } from "../config/qdrant.js";
import { env } from "../config/env.js";
import { generateEmbedding } from "../embeddings/embedding.service.js";

export interface RetrievedChunk {
  content: string;
  score: number;
  documentId: string;
  fileName?: string;
  chunkIndex: number;
  pageStart?: number;
  pageEnd?: number;
}

export interface RetrievalOptions {
  topK?: number;
  scoreThreshold?: number;
}

export async function retrieveDocuments(
  question: string,
  options: RetrievalOptions
): Promise<RetrievedChunk[]> {

  // 1. Generate query embedding
  const queryVector = await generateEmbedding(question);

  // 2. Search Qdrant
  const response = await qdrantClient.query(
    env.qdrantCollection,
    {
      query: queryVector,
      limit: options.topK ?? 5,
      with_payload: true,
      score_threshold: options.scoreThreshold,
    }
  );

  // 3. Transform search results
  return response.points
    .filter((result) => result.payload?.content)
    .map((result) => {
      const payload = result.payload as Record<string, unknown>;

      return {
        content: String(payload.content),
        score: result.score,
        documentId: String(payload.documentId),
        fileName: payload.fileName
          ? String(payload.fileName)
          : undefined,
        chunkIndex: Number(payload.chunkIndex),
        pageStart: payload.pageStart !== undefined
          ? Number(payload.pageStart)
          : undefined,
        pageEnd: payload.pageEnd !== undefined
          ? Number(payload.pageEnd)
          : undefined,
      };
    });
}
