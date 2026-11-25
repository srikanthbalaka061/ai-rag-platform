import { Embeddings } from "@langchain/core/embeddings";
import { pipeline } from "@huggingface/transformers";
import { env } from "../config/env.js";

import type {
  PdfChunk,
  PdfEmbeddedChunk,
} from "../ingestion/chunking/pdf/pdf-chunk.types.js";

const EMBEDDING_BATCH_SIZE = 16;

type FeatureExtractor = Awaited<
  ReturnType<typeof pipeline<"feature-extraction">>
>;

let extractorPromise: Promise<FeatureExtractor> | undefined;

function getExtractor(): Promise<FeatureExtractor> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", env.embeddingModel)
      .catch((error: unknown) => {
        extractorPromise = undefined;
        throw error;
      });
  }

  return extractorPromise;
}

class TransformersEmbeddings extends Embeddings {
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];

    for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE);
      const batchVectors = await this.caller.call(async () => {
        const extractor = await getExtractor();
        const output = await extractor(batch, {
          pooling: "mean",
          normalize: true,
        });

        return validateVectors(output.tolist(), batch.length);
      });
      vectors.push(...batchVectors);
    }

    return vectors;
  }

  async embedQuery(text: string): Promise<number[]> {
    const [vector] = await this.embedDocuments([text]);
    if (!vector) {
      throw new Error("Embedding model returned no vector for the query");
    }
    return vector;
  }
}

function validateVectors(output: unknown[], expectedCount: number): number[][] {
  if (output.length !== expectedCount) {
    throw new Error(
      `Embedding count mismatch: expected ${expectedCount}, received ${output.length}`
    );
  }

  return output.map((value, index) => {
    if (
      !Array.isArray(value) ||
      value.length !== env.embeddingDimension ||
      !value.every(
        (item): item is number => typeof item === "number" && Number.isFinite(item)
      )
    ) {
      throw new Error(`Invalid embedding vector at batch index ${index}`);
    }

    return value;
  });
}

const embeddings = new TransformersEmbeddings({});

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return embeddings.embedDocuments(texts);
}

export async function generatePdfEmbeddings(
  chunks: PdfChunk[]
): Promise<PdfEmbeddedChunk[]> {
  const vectors = await generateEmbeddings(chunks.map((chunk) => chunk.content));
  return chunks.map((chunk, index) => ({ ...chunk, vector: vectors[index] }));
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return embeddings.embedQuery(text);
}

export async function initializeEmbeddingModel(): Promise<void> {
  await getExtractor();
}
