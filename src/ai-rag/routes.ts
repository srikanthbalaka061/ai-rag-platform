import { Router } from "express";
import ingestionRoutes from "./routes/ingestion.routes.js";
import ragRoutes from "./routes/rag.routes.js";

const router = Router();

router.use("/rag", ragRoutes);
router.use("/documents", ingestionRoutes);

export default router;
