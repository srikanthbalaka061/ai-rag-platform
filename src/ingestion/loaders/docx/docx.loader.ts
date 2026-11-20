import mammoth from "mammoth";

import type {
  DocumentLoader,
  DocumentSource,
  ExtractedDocument,
} from "../../core/ingestion.types.js";

import { createExtractedDocument } from "../loader.utils.js";

export class DocxLoader implements DocumentLoader {
  async load(source: DocumentSource): Promise<ExtractedDocument> {
    const result = await mammoth.extractRawText({
      path: source.filePath,
    });

    if (!result.value.trim()) {
      throw new Error(
        `No text extracted from DOCX: ${source.fileName}`
      );
    }

    return createExtractedDocument(
      source,
      result.value,
      {
        documentType: "docx",
        extractionMethod: "mammoth",
        warnings: result.messages,
      }
    );
  }
}