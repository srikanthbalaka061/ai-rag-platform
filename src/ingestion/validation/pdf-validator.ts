import { open } from "node:fs/promises";

export async function validatePdf(filePath: string): Promise<void> {
  const file = await open(filePath, "r");

  try {
    const header = Buffer.alloc(1024);
    const { bytesRead } = await file.read(header, 0, header.length, 0);

    if (!header.subarray(0, bytesRead).toString("latin1").includes("%PDF-")) {
      throw new Error(`Not a valid PDF file: ${filePath}`);
    }
  } finally {
    await file.close();
  }
}

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