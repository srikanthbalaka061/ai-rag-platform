import { generateEmbedding } from "../../embeddings/embedding.service.js";
import type { EmbeddingProvider } from "../core/ingestion.types.js";

const EMBEDDING_BATCH_SIZE = 16;

export class EmbeddingService implements EmbeddingProvider {
  async embedMany(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE);
      embeddings.push(...await Promise.all(batch.map(generateEmbedding)));
    }

    return embeddings;
  }
}