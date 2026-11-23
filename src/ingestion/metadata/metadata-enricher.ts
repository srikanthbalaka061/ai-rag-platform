import { createHash } from "node:crypto";
import type {
  ExtractedDocument,
  MetadataProcessor,
} from "../core/ingestion.types.js";

export class MetadataEnricher implements MetadataProcessor {
  async enrich(document: ExtractedDocument): Promise<ExtractedDocument> {
    const contentHash = createHash("sha256")
      .update(document.content, "utf8")
      .digest("hex");

    return {
      ...document,
      metadata: {
        ...document.metadata,
        contentHash,
      },
    };
  }
}