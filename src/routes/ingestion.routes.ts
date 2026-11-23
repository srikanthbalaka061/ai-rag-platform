import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Router, type RequestHandler } from "express";
import multer from "multer";
import { z } from "zod";
import { ingestionService } from "../ingestion/ingestion.service.js";

const router = Router();
const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;
const upload = multer({
  storage: multer.diskStorage({
    destination: tmpdir(),
    filename: (_req, file, callback) => {
      const extension = path.extname(path.basename(file.originalname)).toLowerCase();
      callback(null, `${randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: MAX_UPLOAD_SIZE, files: 1 },
});

const uploadMiddleware: RequestHandler = (req, res, next) => {
  upload.single("file")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      res.status(status).json({ message: error.message });
      return;
    }

    next(error);
  });
};

const ingestSchema = z.object({
  tenantId: z.string().trim().min(1).max(128),
  uploadedBy: z.string().trim().min(1).max(128),
  tags: z.string().optional(),
});

router.post("/ingest", uploadMiddleware, async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: 'A file is required in the "file" field' });
    return;
  }

  try {
    const validation = ingestSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        message: "Invalid ingestion request",
        errors: validation.error.flatten(),
      });
      return;
    }

    const fileName = path.basename(req.file.originalname);
    if (!ingestionService.supportsFile(fileName)) {
      res.status(415).json({ message: "Unsupported document format" });
      return;
    }

    const result = await ingestionService.ingestDocument({
      documentId: randomUUID(),
      filePath: req.file.path,
      fileName,
      mimeType: req.file.mimetype,
      tenantId: validation.data.tenantId,
      uploadedBy: validation.data.uploadedBy,
      tags: validation.data.tags
        ?.split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Document ingestion failed:", error);
    res.status(500).json({ message: "Failed to ingest document" });
  } finally {
    try {
      await rm(req.file.path, { force: true });
    } catch (error) {
      console.error("Failed to remove temporary upload:", error);
    }
  }
});

export default router;
