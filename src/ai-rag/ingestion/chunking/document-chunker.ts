import { randomUUID } from "node:crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type {
  DocumentChunk,
  DocumentChunker as DocumentChunkerContract,
  ExtractedDocument,
} from "../core/ingestion.types.js";

const CHUNK_SIZE = 1_000;
const CHUNK_OVERLAP = 150;

export class DocumentChunker implements DocumentChunkerContract {
  async chunk(document: ExtractedDocument): Promise<DocumentChunk[]> {
    const extension = String(document.metadata.fileExtension ?? "").toLowerCase();
    const splitter =
      extension === ".md" || extension === ".markdown"
        ? RecursiveCharacterTextSplitter.fromLanguage("markdown", {
            chunkSize: CHUNK_SIZE,
            chunkOverlap: CHUNK_OVERLAP,
          })
        : extension === ".html" || extension === ".htm"
          ? RecursiveCharacterTextSplitter.fromLanguage("html", {
              chunkSize: CHUNK_SIZE,
              chunkOverlap: CHUNK_OVERLAP,
            })
          : new RecursiveCharacterTextSplitter({
              chunkSize: CHUNK_SIZE,
              chunkOverlap: CHUNK_OVERLAP,
            });
    const contents = await splitter.splitText(document.content.trim());

    return contents
      .map((content) => content.trim())
      .filter((content) => content.length > 0)
      .map((content, chunkIndex) => ({
        id: randomUUID(),
        documentId: document.documentId,
        content,
        chunkIndex,
        metadata: {
          ...document.metadata,
          chunkCharacterCount: content.length,
        },
      }));
  }
}
