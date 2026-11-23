import { DocumentCleaner } from "../cleaning/document-cleaner.js";
import { DocumentChunker } from "../chunking/document-chunker.js";
import { EmbeddingService } from "../embeddings/embedding.service.js";
import { MetadataEnricher } from "../metadata/metadata-enricher.js";
import { QdrantVectorStore } from "../vector-store/qdrant/qdrant.store.js";
import { ingestionRegistry } from "../loaders/index.js";
import { IngestionPipeline } from "./ingestion.pipeline.js";
import type { DocumentSource } from "./ingestion.types.js";

export async function ingestDocument(source: DocumentSource) {
  const pipeline = new IngestionPipeline(
    ingestionRegistry.getLoader(source),
    new DocumentCleaner(),
    new MetadataEnricher(),
    new DocumentChunker(),
    new EmbeddingService(),
    new QdrantVectorStore()
  );

  return pipeline.execute(source);
}