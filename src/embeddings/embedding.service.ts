import { pipeline } from "@huggingface/transformers";
import { env } from "../config/env.js";

import type {
  PdfChunk,
  PdfEmbeddedChunk,
} from "../ingestion/chunking/pdf/pdf-chunk.types.js";

type FeatureExtractor = Awaited<
  ReturnType<typeof pipeline<"feature-extraction">>
>;

let extractor: FeatureExtractor | undefined;

async function getModel(): Promise<FeatureExtractor> {
  if (!extractor) {
    extractor = await pipeline(
      "feature-extraction",
      env.embeddingModel
    );
  }

  return extractor;
}

export async function generatePdfEmbeddings(
  chunks: PdfChunk[]
): Promise<PdfEmbeddedChunk[]> {
  const result: PdfEmbeddedChunk[] = [];
  const batchSize = 16;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    for (const chunk of batch) {
      result.push({
        ...chunk,
        vector: await generateEmbedding(chunk.content),
      });
    }
  }

  return result;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = await getModel();
  const output = await model(text, {
    pooling: "mean",
    normalize: true,
  });

  return Array.from(output.data as Float32Array);
}