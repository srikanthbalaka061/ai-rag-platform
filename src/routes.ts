import { Router } from "express";
import aiRagRoutes from "./ai-rag/routes.js";
import marketDataRoutes from "./market-data/routes/index.js";

const router = Router();

router.use("/api", aiRagRoutes);
router.use("/api/market-data", marketDataRoutes);

export default router;
