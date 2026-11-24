import { Router } from "express";
import { z } from "zod";
import { askQuestion } from "../../market-data/services/service.js";

const router = Router();

const askSchema = z.object({
  question: z.string().min(1),
  tenantId: z.string().min(1),
  topK: z.number().int().min(1).max(20).optional(),
  scoreThreshold: z.number().min(0).max(1).optional(),
});

router.post("/ask", async (req, res) => {
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

    res.json(result);
  } catch (error) {
    console.error("RAG error:", error);

    res.status(500).json({
      message: "Failed to generate answer",
      error: error instanceof Error
        ? error.message
        : "Unknown error",
    });
  }
});

export default router;