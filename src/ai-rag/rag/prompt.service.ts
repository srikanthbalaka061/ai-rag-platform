import type { RetrievedChunk } from "../retrieval/retrieval.service.js";

export function createRagPrompt(
  question: string,
  chunks: RetrievedChunk[]
): string {
  const instruction =
    "Answer using only the context. Be concise. If the context does not contain the answer, say so.\n\nContext:\n";
  const questionBlock = `\n\nQuestion: ${question}\nAnswer:`;
  const maxPromptCharacters = 2_000;
  let remainingContextCharacters = Math.max(
    0,
    maxPromptCharacters - instruction.length - questionBlock.length
  );
  const contextParts: string[] = [];

  for (const chunk of chunks) {
    if (remainingContextCharacters <= 0) break;
    const excerpt = chunk.content.slice(0, remainingContextCharacters).trim();
    if (!excerpt) continue;
    contextParts.push(excerpt);
    remainingContextCharacters -= excerpt.length + 2;
  }

  return `${instruction}${contextParts.join("\n\n")}${questionBlock}`;
}
