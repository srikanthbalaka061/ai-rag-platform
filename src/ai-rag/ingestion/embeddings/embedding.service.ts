import { generateEmbeddings } from "../../embeddings/embedding.service.js";
import type { EmbeddingProvider } from "../core/ingestion.types.js";

export class EmbeddingService implements EmbeddingProvider {
  async embedMany(texts: string[]): Promise<number[][]> {
    return generateEmbeddings(texts);
  }
}