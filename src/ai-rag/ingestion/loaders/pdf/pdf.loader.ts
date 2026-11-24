import fs from "node:fs/promises";
import pdf from "pdf-parse";

import type {
  DocumentLoader,
  DocumentSource,
  ExtractedDocument,
} from "../../core/ingestion.types.js";

import { createExtractedDocument } from "../loader.utils.js";

export class PdfLoader implements DocumentLoader {
  async load(source: DocumentSource): Promise<ExtractedDocument> {
    const buffer = await fs.readFile(source.filePath);

    const result = await pdf(buffer);

    if (!result.text.trim()) {
      throw new Error(
        `No extractable text found in PDF: ${source.fileName}. It may require OCR.`
      );
    }

    return createExtractedDocument(
      source,
      result.text,
      {
        documentType: "pdf",
        totalPages: result.numpages,
        pdfInfo: result.info,
        extractionMethod: "pdf-parse",
      }
    );
  }
}