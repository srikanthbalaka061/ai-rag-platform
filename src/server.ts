import express from "express";
import { env } from "./ai-rag/config/env.js";
import routes from "./routes.js";
import { startMarketDataScheduler } from "./market-data/scheduler/market-data.scheduler.js";
import { initializeCollection } from "./ai-rag/vector-store/qdrant.service.js";
import { initializeRagModels } from "./ai-rag/rag/rag.service.js";

const app = express();

app.use(express.json());
app.use(routes);

async function startServer(): Promise<void> {
  await initializeCollection();
  console.info("Loading local RAG models...");
  await initializeRagModels();
  console.info("Local RAG models ready");
  startMarketDataScheduler();

  app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
}

startServer().catch((error: unknown) => {
  console.error("Failed to initialize application dependencies:", error);
  process.exitCode = 1;
});
