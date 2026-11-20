export interface DocumentSource {
  documentId: string;
  filePath: string;
  fileName: string;
  mimeType?: string;
  tenantId: string;
  uploadedBy: string;
  tags?: string[];
}

export interface ExtractedDocument {
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
  parentId?: string;
}

export interface EmbeddedChunk extends DocumentChunk {
  vector: number[];
}

export interface VectorRecord {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface DocumentLoader {
  load(source: DocumentSource): Promise<ExtractedDocument>;
}

export interface DocumentCleaner {
  clean(document: ExtractedDocument): Promise<ExtractedDocument>;
}

export interface MetadataProcessor {
  enrich(document: ExtractedDocument): Promise<ExtractedDocument>;
}

export interface DocumentChunker {
  chunk(document: ExtractedDocument): Promise<DocumentChunk[]>;
}

export interface EmbeddingProvider {
  embedMany(texts: string[]): Promise<number[][]>;
}

export interface VectorStore {
  upsert(records: VectorRecord[]): Promise<void>;
}

export interface IngestionResult {
  documentId: string;
  totalChunks: number;
  status: "completed" | "failed";
}