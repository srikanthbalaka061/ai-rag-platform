import type {
  DocumentSource,
  DocumentLoader,
  DocumentCleaner,
  MetadataProcessor,
  DocumentChunker,
  EmbeddingProvider,
  VectorStore,
  VectorRecord,
  IngestionResult,
} from "./ingestion.types.js";

import { randomUUID } from "node:crypto";
import { IngestionError } from "./ingestion.errors.js";

export class IngestionPipeline {
  constructor(
    private readonly loader: DocumentLoader,
    private readonly cleaner: DocumentCleaner,
    private readonly metadataProcessor: MetadataProcessor,
    private readonly chunker: DocumentChunker,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly vectorStore: VectorStore
  ) {}

  async execute(
    source: DocumentSource
  ): Promise<IngestionResult> {
    try {
      // 1. Load document
      let document = await this.loader.load(source);

      // 2. Clean document
      document = await this.cleaner.clean(document);

      // 3. Extract and enrich metadata
      document = await this.metadataProcessor.enrich(document);

      // 4. Generate chunks
      const chunks = await this.chunker.chunk(document);

      if (chunks.length === 0) {
        throw new Error("No chunks generated");
      }

      // 5. Generate embeddings
      const vectors = await this.embeddingProvider.embedMany(
        chunks.map((chunk) => chunk.content)
      );

      if (vectors.length !== chunks.length) {
        throw new Error("Embedding count does not match chunk count");
      }

      // 6. Prepare Qdrant records
      const records: VectorRecord[] = chunks.map(
        (chunk, index) => ({
          id: chunk.id || randomUUID(),
          vector: vectors[index],
          payload: {
            ...chunk.metadata,
            content: chunk.content,
            documentId: source.documentId,
            tenantId: source.tenantId,
            uploadedBy: source.uploadedBy,
            fileName: source.fileName,
            chunkIndex: chunk.chunkIndex,
            parentId: chunk.parentId ?? null,
          },
        })
      );

      // 7. Store vectors
      await this.vectorStore.upsert(records);

      return {
        documentId: source.documentId,
        totalChunks: chunks.length,
        status: "completed",
      };
    } catch (error) {
      throw new IngestionError(
        `Ingestion failed for document ${source.documentId}`,
        source.documentId,
        { cause: error }
      );
    }
  }
}