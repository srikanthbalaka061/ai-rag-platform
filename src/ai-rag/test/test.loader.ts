import { ingestionService } from "../ingestion/ingestion.service.js";

const supportedFiles = [
  {
    fileName: "valmiki_ramayanam.pdf",
    filePath: "./data/documents/valmiki_ramayanam.pdf",
  },
//   {
//     fileName: "sample.docx",
//     filePath: "./data/documents/sample.docx",
//   },
//   {
//     fileName: "sample.txt",
//     filePath: "./data/documents/sample.txt",
//   },
//   {
//     fileName: "sample.md",
//     filePath: "./data/documents/sample.md",
//   },
//   {
//     fileName: "sample.csv",
//     filePath: "./data/documents/sample.csv",
//   },
//   {
//     fileName: "sample.xlsx",
//     filePath: "./data/documents/sample.xlsx",
//   },
//   {
//     fileName: "sample.json",
//     filePath: "./data/documents/sample.json",
//   },
//   {
//     fileName: "sample.html",
//     filePath: "./data/documents/sample.html",
//   },
];

async function testLoaders() {
  for (const file of supportedFiles) {
    try {
      const document = await ingestionService.loadDocument({
        documentId: crypto.randomUUID(),
        filePath: file.filePath,
        fileName: file.fileName,
        tenantId: "tenant-001",
        uploadedBy: "user-001",
      });

      console.log("\n------------------------------");
      console.log(`File: ${file.fileName}`);
      console.log(`Extracted characters: ${document.content.length}`);
      console.log("Metadata:", document.metadata);
      console.log("Preview:", document.content.slice(0, 300));
    } catch (error) {
      console.error(`Failed: ${file.fileName}`, error);
    }
  }
}

testLoaders();