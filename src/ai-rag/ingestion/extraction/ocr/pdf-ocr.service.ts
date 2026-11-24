import { createWorker } from "tesseract.js";

type OcrRecognizer = (imageBuffer: Buffer) => Promise<string>;

export async function withOcrWorker<T>(
  operation: (recognize: OcrRecognizer) => Promise<T>,
): Promise<T> {
  const worker = await createWorker("eng");

  try {
    return await operation(async (imageBuffer) => {
      const result = await worker.recognize(imageBuffer);
      return result.data.text;
    });
  } finally {
    await worker.terminate();
  }
}

export async function extractTextUsingOcr(
  imageBuffer: Buffer,
): Promise<string> {
  return withOcrWorker((recognize) => recognize(imageBuffer));
}