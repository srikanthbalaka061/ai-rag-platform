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

test("keeps overlapping content between consecutive chunks", async () => {
  const content = Array.from(
    { length: 400 },
    (_, index) => `word${String(index).padStart(3, "0")}`
  ).join(" ");
  const chunks = await new DocumentChunker().chunk({
    documentId: "doc-2",
    content,
    metadata: {},
  });

  assert.ok(chunks.length > 1);
  for (let index = 0; index < chunks.length - 1; index += 1) {
    const previous = chunks[index].content;
    const next = chunks[index + 1].content;
    const hasOverlap = Array.from(
      { length: Math.min(300, previous.length, next.length) - 99 },
      (_, offset) => 300 - offset
    ).some((length) => previous.endsWith(next.slice(0, length)));

    assert.ok(hasOverlap, `chunks ${index} and ${index + 1} should overlap`);
  }
});
