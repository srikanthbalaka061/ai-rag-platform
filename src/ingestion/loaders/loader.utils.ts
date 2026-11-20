import path from "node:path";
import type {
  DocumentSource,
  ExtractedDocument,
} from "../core/ingestion.types.js";

export function createExtractedDocument(
  source: DocumentSource,
  content: string,
  extraMetadata: Record<string, unknown> = {}
): ExtractedDocument {
  return {
    documentId: source.documentId,
    content,
    metadata: {
      fileName: source.fileName,
      filePath: source.filePath,
      fileExtension: path.extname(source.fileName).toLowerCase(),
      mimeType: source.mimeType ?? "application/octet-stream",
      tenantId: source.tenantId,
      uploadedBy: source.uploadedBy,
      ...extraMetadata,
    },
  };
}