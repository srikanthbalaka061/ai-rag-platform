import type {
  DocumentSource,
  ExtractedDocument,
} from "./core/ingestion.types.js";

import { ingestionRegistry } from "./loaders/index.js";
import { WebLoader } from "./loaders/web/web.loader.js";

export class IngestionService {
  private webLoader = new WebLoader();

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
}

export const ingestionService = new IngestionService();