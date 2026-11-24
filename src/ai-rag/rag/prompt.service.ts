import type { RetrievedChunk } from "../retrieval/retrieval.service.js";

export function createRagPrompt(
  question: string,
  chunks: RetrievedChunk[]
): string {
  const context = chunks.map((chunk, index) => `
Excerpt ${index + 1}:
${chunk.content}
`).join("\n------------------------\n");

  return `Answer the question using only the context below.
Write a concise answer in natural language. Do not output excerpt labels, source numbers, document metadata, or the context itself.
If the context does not contain the answer, say that the documents do not provide the answer.

Context:
${context}

Question: ${question}
Answer:`;
}