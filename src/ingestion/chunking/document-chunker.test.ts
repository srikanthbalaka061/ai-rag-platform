import assert from "node:assert/strict";
import test from "node:test";
import { DocumentChunker } from "./document-chunker.js";

test("chunks long content within the configured maximum and preserves order", async () => {
  const content = "x".repeat(3000);
  const chunks = await new DocumentChunker().chunk({
    documentId: "doc-1",
    content,
    metadata: {},
  });

  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.content.length <= 1200));
  assert.deepEqual(
    chunks.map((chunk) => chunk.chunkIndex),
    chunks.map((_, index) => index)
  );
  assert.ok(chunks.every((chunk) => chunk.documentId === "doc-1"));
});
