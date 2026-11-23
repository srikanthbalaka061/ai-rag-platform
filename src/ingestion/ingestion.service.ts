import type {
  DocumentSource,
  ExtractedDocument,
} from "./core/ingestion.types.js";

import { ingestionRegistry } from "./loaders/index.js";
import { WebLoader } from "./loaders/web/web.loader.js";
import { ingestDocument } from "./core/ingestion.orchestrator.js";

export class IngestionService {
  private webLoader = new WebLoader();

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
    return ingestDocument(source);
  }
}

export const ingestionService = new IngestionService();