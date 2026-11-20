import { generateEmbedding } from "../embeddings/embedding.service.js";
import {
  checkQdrantConnection,
  initializeCollection,
} from "../vector-store/qdrant-store.js";

async function main() {
  try {
    await checkQdrantConnection();
    await initializeCollection();

    console.log("Qdrant Cloud setup completed!");
    const vector = await generateEmbedding(
  "HDFC Bank reported strong deposit growth"
);

console.log("Vector dimensions:", vector.length);
console.log("First five values:", vector.slice(0, 5));
  } catch (error) {
    console.error("Setup failed:", error);
    process.exitCode = 1;
  }
}

main();