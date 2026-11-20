import { env } from "../config/env.js";
import { qdrantClient } from "../config/qdrant.js";

export type VectorRecord = {
  id: string | number;
  vector: number[];
  payload: Record<string, unknown>;
};

export async function checkQdrantConnection(): Promise<void> {
  const result = await qdrantClient.getCollections();
  console.log("Connected to Qdrant Cloud");
  console.log("Available collections:", result.collections);
}

export async function initializeCollection(): Promise<void> {
  const collectionName = env.qdrantCollection;
  const collections = await qdrantClient.getCollections();
  const exists = collections.collections.some(
    (collection) => collection.name === collectionName,
  );

  if (!exists) {
    await qdrantClient.createCollection(collectionName, {
      vectors: {
        size: env.embeddingDimension,
        distance: "Cosine",
      },
    });
    console.log(`Collection created: ${collectionName}`);
  }

  const collection = await qdrantClient.getCollection(collectionName);
  const tenantIndex = collection.payload_schema.tenantId;

  if (!tenantIndex) {
    await qdrantClient.createPayloadIndex(collectionName, {
      field_name: "tenantId",
      field_schema: "keyword",
      wait: true,
    });
    console.log(`Payload index created: ${collectionName}.tenantId`);
  } else if (tenantIndex.data_type !== "keyword") {
    throw new Error(
      `Qdrant payload index for tenantId must be keyword, received ${tenantIndex.data_type}`,
    );
  }
}

export async function upsertVector(record: VectorRecord): Promise<void> {
  validateVector(record.vector);
  await qdrantClient.upsert(env.qdrantCollection, {
    points: [
      {
        id: record.id,
        vector: record.vector,
        payload: record.payload,
      },
    ],
  });
}

export async function searchVectors(
  vector: number[],
  limit = 5,
) {
  validateVector(vector);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Search limit must be a positive integer");
  }

  const result = await qdrantClient.query(env.qdrantCollection, {
    query: vector,
    limit,
    with_payload: true,
  });

  return result.points;
}

function validateVector(vector: number[]): void {
  if (vector.length !== env.embeddingDimension) {
    throw new Error(
      `Expected a ${env.embeddingDimension}-dimension vector, received ${vector.length}`,
    );
  }
  if (!vector.every(Number.isFinite)) {
    throw new Error("Vector values must all be finite numbers");
  }
}
