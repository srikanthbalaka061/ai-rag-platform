import type {
  DocumentSource,
  ExtractedDocument,
} from "./core/ingestion.types.js";

import { ingestionRegistry } from "./loaders/index.js";
import { WebLoader } from "./loaders/web/web.loader.js";
import { ingestDocument } from "./core/ingestion.orchestrator.js";
import { QdrantVectorStore } from "./vector-store/qdrant/qdrant.store.js";
import { DuplicateDocumentError } from "./core/ingestion.errors.js";

export class IngestionService {
  private webLoader = new WebLoader();
  private vectorStore = new QdrantVectorStore();
  private activeDocumentIds = new Set<string>();

  supportsFile(fileName: string): boolean {
    return ingestionRegistry.supports(fileName);
  }

  async loadDocument(
    source: DocumentSource
  ): Promise<ExtractedDocument> {
    const loader = ingestionRegistry.getLoader(source);

    return loader.load(source);
  }

  async loadWebPage(
    source: Parameters<WebLoader["loadUrl"]>[0]
  ): Promise<ExtractedDocument> {
    return this.webLoader.loadUrl(source);
  }

  async ingestDocument(source: DocumentSource) {
    const lockKey = `${source.tenantId}\u0000${source.documentId}`;
    if (this.activeDocumentIds.has(lockKey)) {
      throw new DuplicateDocumentError(source.documentId);
    }

    this.activeDocumentIds.add(lockKey);
    let ingestionStarted = false;
    try {
      if (await this.vectorStore.documentExists(source.documentId, source.tenantId)) {
        throw new DuplicateDocumentError(source.documentId);
      }

      ingestionStarted = true;
      return await ingestDocument(source);
    } catch (error) {
      if (ingestionStarted) {
        try {
          await this.vectorStore.deleteDocumentChunks(
            source.documentId,
            source.tenantId
          );
        } catch (cleanupError) {
          console.error("Failed to roll back partial document ingestion:", cleanupError);
        }
      }
      throw error;
    } finally {
      this.activeDocumentIds.delete(lockKey);
    }
  }

  async deleteDocument(documentId: string, tenantId: string) {
    return this.vectorStore.deleteDocumentChunks(documentId, tenantId);
  }
}

export const ingestionService = new IngestionService();
