import assert from "node:assert/strict";
import test from "node:test";
import { IngestionError } from "./ingestion.errors.js";
import { IngestionPipeline } from "./ingestion.pipeline.js";
import type {
  DocumentChunk,
  DocumentSource,
  ExtractedDocument,
} from "./ingestion.types.js";

const source: DocumentSource = {
  documentId: "doc-1",
  filePath: "document.txt",
  fileName: "document.txt",
  tenantId: "tenant-1",
  uploadedBy: "user-1",
};

function createPipeline(loaderFailure?: Error) {
  let storedRecords = 0;
  const document: ExtractedDocument = {
    documentId: source.documentId,
    content: "document content",
    metadata: {},
  };
  const chunk: DocumentChunk = {
    id: "chunk-1",
    documentId: source.documentId,
    content: document.content,
    chunkIndex: 0,
    metadata: {},
  };

  const pipeline = new IngestionPipeline(
    {
      load: async () => {
        if (loaderFailure) throw loaderFailure;
        return document;
      },
    },
    { clean: async (value) => value },
    { enrich: async (value) => value },
    { chunk: async () => [chunk] },
    { embedMany: async () => [[0.1, 0.2]] },
    {
      upsert: async (records) => {
        storedRecords = records.length;
      },
    }
  );

  return { pipeline, getStoredRecords: () => storedRecords };
}

test("ingests and stores chunks successfully", async () => {
  const { pipeline, getStoredRecords } = createPipeline();

  const result = await pipeline.execute(source);

  assert.deepEqual(result, {
    documentId: source.documentId,
    totalChunks: 1,
    status: "completed",
  });
  assert.equal(getStoredRecords(), 1);
});

test("propagates ingestion failures instead of returning a failed-shaped result", async () => {
  const cause = new Error("loader failed");
  const { pipeline } = createPipeline(cause);

  await assert.rejects(
    pipeline.execute(source),
    (error: unknown) =>
      error instanceof IngestionError &&
      error.documentId === source.documentId &&
      error.cause === cause
  );
});
