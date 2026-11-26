import { Router } from "express";
import { z } from "zod";
import { QdrantClientTimeoutError } from "@qdrant/js-client-rest";
import { askQuestion } from "../rag/rag.service.js";

const router = Router();

const askSchema = z.object({
  question: z.string().trim().min(1).max(4_000),
  topK: z.number().int().min(1).max(8).optional(),
  scoreThreshold: z.number().min(0).max(1).optional(),
});

router.post("/ask", async (req, res) => {
  const startedAt = Date.now();
  try {
    const validation = askSchema.safeParse(req.body);

    if (!validation.success) {
      res.status(400).json({
        message: "Invalid request",
        errors: validation.error.flatten(),
      });
      return;
    }

    const result = await askQuestion(validation.data);

    res.setHeader("Server-Timing", `rag;dur=${Date.now() - startedAt}`);
    res.json(result);
  } catch (error) {
    console.error("RAG error:", error);
    res.setHeader("Server-Timing", `rag;dur=${Date.now() - startedAt}`);

    if (error instanceof QdrantClientTimeoutError) {
      res.status(504).json({
        message: "Document search timed out. Please try again.",
        error: "RAG_DEPENDENCY_TIMEOUT",
      });
      return;
    }

    res.status(500).json({
      message: "Failed to generate answer",
      error: "RAG_REQUEST_FAILED",
    });
  }
});

export default router;
