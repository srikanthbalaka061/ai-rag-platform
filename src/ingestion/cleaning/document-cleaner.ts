import { cleanText } from "./text-cleaner.js";
import type {
  DocumentCleaner as DocumentCleanerContract,
  ExtractedDocument,
} from "../core/ingestion.types.js";

export class DocumentCleaner implements DocumentCleanerContract {
  async clean(document: ExtractedDocument): Promise<ExtractedDocument> {
    const content = cleanText(document.content);

    if (!content) {
      throw new Error(`Document ${document.documentId} contains no text`);
    }

    return { ...document, content };
  }
}
