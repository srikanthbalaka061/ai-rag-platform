import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "./env.js";

export const qdrantClient = new QdrantClient({
  url: env.qdrantUrl,
  apiKey: env.qdrantApiKey,
  timeout: 15_000,
});
