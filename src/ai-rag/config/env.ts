import "dotenv/config";

function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),

  qdrantUrl: getRequiredEnv("QDRANT_URL"),
  qdrantApiKey: getRequiredEnv("QDRANT_API_KEY"),
  qdrantCollection:
    process.env.QDRANT_COLLECTION ?? "enterprise_documents",

  embeddingModel:
    process.env.EMBEDDING_MODEL ??
    "Xenova/all-MiniLM-L6-v2",

  generationModel:
    process.env.GENERATION_MODEL ?? "Xenova/flan-t5-small",

  embeddingDimension: Number(
    process.env.EMBEDDING_DIMENSION ?? 384
  ),
};