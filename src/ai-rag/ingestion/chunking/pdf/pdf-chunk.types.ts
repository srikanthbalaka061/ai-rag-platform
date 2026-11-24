export interface PdfPage {
  pageNumber: number;
  text: string;
  extractionMethod: "text" | "ocr";
}

export interface PdfDocument {
  documentId: string;
  fileName: string;
  pages: PdfPage[];
  metadata: {
    title?: string;
    author?: string;
    totalPages: number;
    fileSize: number;
    contentHash: string;
    tenantId: string;
  };
}

export interface PdfChunk {
  id: string;
  documentId: string;
  content: string;

  chunkIndex: number;

  pageStart: number;
  pageEnd: number;

  metadata: Record<string, unknown>;
}

export interface PdfEmbeddedChunk extends PdfChunk {
  vector: number[];
}