import fs from "node:fs/promises";

import type {
  DocumentLoader,
  DocumentSource,
  ExtractedDocument,
} from "../../core/ingestion.types.js";

import { createExtractedDocument } from "../loader.utils.js";

export class MarkdownLoader implements DocumentLoader {
  async load(source: DocumentSource): Promise<ExtractedDocument> {
    const content = await fs.readFile(
      source.filePath,
      "utf-8"
    );

    if (!content.trim()) {
      throw new Error(`Empty Markdown file: ${source.fileName}`);
    }

    return createExtractedDocument(
      source,
      content,
      {
        documentType: "markdown",
        extractionMethod: "utf-8",
        containsHeadings: /^#{1,6}\s+/m.test(content),
      }
    );
  }
}