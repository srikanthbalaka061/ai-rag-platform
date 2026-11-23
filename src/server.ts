import express from "express";
import { env } from "./config/env.js";
import ragRoutes from "./routes/rag.routes.js";
import ingestionRoutes from "./routes/ingestion.routes.js";
import { initializeCollection } from "./vector-store/qdrant.service.js";

const app = express();

app.use(express.json());

app.use("/api/rag", ragRoutes);
app.use("/api/documents", ingestionRoutes);

async function startServer(): Promise<void> {
  await initializeCollection();

  app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
}

startServer().catch((error: unknown) => {
  console.error("Failed to initialize Qdrant:", error);
  process.exitCode = 1;
});