import fs from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";

import { validatePdf } from "../validation/pdf-validator.js";
import { extractPdfPages } from "../extraction/pdf/pdf-page-extractor.js";
import { cleanPdfText } from "../cleaning/pdf.clean.js";
import { extractPdfMetadata } from "../metadata/pdf.metadata.service.js";
import { createPdfChunks } from "../chunking/recursive/recursive.chunker.js";
import { generatePdfEmbeddings } from "../../embeddings/embedding.service.js";
import { storePdfChunks } from "../vector-store/vector-store.interface.js";

export interface PdfIngestionInput {
  filePath: string;
  fileName: string;
  tenantId: string;
  uploadedBy: string;
}

export async function ingestPdf(
  input: PdfIngestionInput
) {
  const documentId = randomUUID();

  await validatePdf(input.filePath);

  const fileBuffer = await fs.readFile(input.filePath);

  const contentHash = createHash("sha256")
    .update(fileBuffer)
    .digest("hex");

  const pages = await extractPdfPages(input.filePath);

  const cleanedPages = pages.map((page) => ({
    ...page,
    text: cleanPdfText(page.text),
  }));

  const metadata = await extractPdfMetadata(input.filePath);
console.log("Extracted metadata:", metadata);
  const chunks = await createPdfChunks(
    documentId,
    cleanedPages,
    {
      chunkSize: 1000,
      chunkOverlap: 150,
    }
  );

  if (chunks.length === 0) {
    throw new Error("No chunks were generated from PDF");
  }

  const enrichedChunks = chunks.map((chunk) => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      fileName: input.fileName,
      contentHash,
      ...metadata,
    },
  }));

  const embeddedChunks = await generatePdfEmbeddings(
    enrichedChunks
  );

  await storePdfChunks(
    embeddedChunks,
    input.tenantId
  );

  return {
    documentId,
    fileName: input.fileName,
    totalPages: pages.length,
    totalChunks: chunks.length,
    totalVectors: embeddedChunks.length,
    contentHash,
    status: "completed",
  };
}