import { randomUUID } from "node:crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type {
  DocumentChunk,
  DocumentChunker as DocumentChunkerContract,
  ExtractedDocument,
} from "../core/ingestion.types.js";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;

export class DocumentChunker implements DocumentChunkerContract {
  private readonly splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  async chunk(document: ExtractedDocument): Promise<DocumentChunk[]> {
    const contents = await this.splitter.splitText(document.content);

    return contents
      .filter((content) => content.trim().length > 0)
      .map((content, chunkIndex) => ({
        id: randomUUID(),
        documentId: document.documentId,
        content,
        chunkIndex,
        metadata: { ...document.metadata },
      }));
  }
}
