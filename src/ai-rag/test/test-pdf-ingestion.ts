
import { ingestPdf } from "../ingestion/pdf/pdf.ingestion-servce.js";

async function main() {
  try {
    console.log("Starting PDF ingestion...");

    const result = await ingestPdf({
      documentId: "tenant-001-pdf-test",
      filePath: "./data/documents/Guidelines_for_Quarterly_Payout_of_Variable_Pay.pdf",
      fileName: "Guidelines_for_Quarterly_Payout_of_Variable_Pay.pdf",
      tenantId: "tenant-001",
      uploadedBy: "user-001",
    });

    console.log("\nPDF INGESTION RESULT");
    console.log("====================");

    console.log("Document ID:", result.documentId);
    console.log("File Name:", result.fileName);
    console.log("Total Pages:", result.totalPages);
    console.log("Total Chunks:", result.totalChunks);
    console.log("Total Vectors:", result.totalVectors);
    console.log("Content Hash:", result.contentHash);
    console.log("Status:", result.status);

  } catch (error) {
    console.error("PDF ingestion failed:", error);
  }
}

main();
