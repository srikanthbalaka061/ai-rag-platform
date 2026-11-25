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

const EMBEDDING_BATCH_SIZE = 16;

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

      // 5. Embed and store bounded batches to keep memory use predictable.
      for (let offset = 0; offset < chunks.length; offset += EMBEDDING_BATCH_SIZE) {
        const chunkBatch = chunks.slice(offset, offset + EMBEDDING_BATCH_SIZE);
        const vectors = await this.embeddingProvider.embedMany(
          chunkBatch.map((chunk) => chunk.content)
        );
        if (vectors.length !== chunkBatch.length) {
          throw new Error("Embedding count does not match chunk batch size");
        }

        const records: VectorRecord[] = chunkBatch.map((chunk, index) => {
          const vector = vectors[index];
          if (!vector) {
            throw new Error(`Embedding missing for chunk ${chunk.chunkIndex}`);
          }
          return {
            id: chunk.id || randomUUID(),
            vector,
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
          };
        });

        await this.vectorStore.upsert(records);
      }

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
