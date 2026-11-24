import fs from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractPdfMetadata(filePath: string) {
  const buffer = await fs.readFile(filePath);

  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
  });

  try {
    const pdf = await loadingTask.promise;
    const metadata = await pdf.getMetadata();
    const info = metadata.info;

    return {
      title: "Title" in info && typeof info.Title === "string" ? info.Title : undefined,
      author: "Author" in info && typeof info.Author === "string" ? info.Author : undefined,
      subject: "Subject" in info && typeof info.Subject === "string" ? info.Subject : undefined,
      totalPages: pdf.numPages,
    };
  } finally {
    await loadingTask.destroy();
  }
}