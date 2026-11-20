import { qdrantClient } from "../config/qdrant.js";
import { env } from "../config/env.js";

export async function checkQdrantConnection() {
  try {
    const result = await qdrantClient.getCollections();

    console.log("Connected to Qdrant Cloud");
    console.log("Available collections:", result.collections);

    return true;
  } catch (error) {
    console.error("Qdrant connection failed:", error);
    throw error;
  }
}

export async function initializeCollection() {
  const collectionName = env.qdrantCollection;

  const collections = await qdrantClient.getCollections();

  const exists = collections.collections.some(
    (collection) => collection.name === collectionName
  );

  if (!exists) {
    await qdrantClient.createCollection(collectionName, {
      vectors: {
        size: env.embeddingDimension,
        distance: "Cosine",
      },
    });

    console.log(`Collection created: ${collectionName}`);
  } else {
    console.log(`Collection already exists: ${collectionName}`);
  }
}