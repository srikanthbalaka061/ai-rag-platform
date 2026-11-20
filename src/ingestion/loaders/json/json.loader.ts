import fs from "node:fs/promises";

import type {
  DocumentLoader,
  DocumentSource,
  ExtractedDocument,
} from "../../core/ingestion.types.js";

import { createExtractedDocument } from "../loader.utils.js";

export class JsonLoader implements DocumentLoader {
  async load(source: DocumentSource): Promise<ExtractedDocument> {
    const raw = await fs.readFile(
      source.filePath,
      "utf-8"
    );

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(`Invalid JSON file: ${source.fileName}`);
    }

    return createExtractedDocument(
      source,
      JSON.stringify(parsed, null, 2),
      {
        documentType: "json",
        extractionMethod: "JSON.parse",
        rootType: Array.isArray(parsed)
          ? "array"
          : typeof parsed,
        totalRecords: Array.isArray(parsed)
          ? parsed.length
          : undefined,
      }
    );
  }
}