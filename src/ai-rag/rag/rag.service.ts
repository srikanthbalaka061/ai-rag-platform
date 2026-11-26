import { retrieveDocuments } from "../retrieval/retrieval.service.js";
import { createRagPrompt } from "./prompt.service.js";
import { initializeEmbeddingModel } from "../embeddings/embedding.service.js";
import {
  generateAnswer,
  initializeTextGenerator,
} from "../llm/local-llm.service.js";

export interface AskQuestionInput {
  question: string;
  topK?: number;
  scoreThreshold?: number;
}

export async function initializeRagModels(): Promise<void> {
  await initializeEmbeddingModel();
  await initializeTextGenerator();
}

export async function askQuestion(input: AskQuestionInput) {
  const question = input.question.trim();
  if (!question) {
    throw new Error("Question is required");
  }

  const chunks = await retrieveDocuments(
    question,
    {
      topK: input.topK ?? 3,
      scoreThreshold: input.scoreThreshold,
    }
  );

  if (chunks.length === 0) {
    return {
      question,
      answer: "I couldn't find relevant information in the available documents.",
      sources: [],
    };
  }

  const sourcesByDocument = new Map<string, {
    documentId: string;
    fileName?: string;
    content: string;
    pageStart?: number;
    pageEnd?: number;
    matchedChunks: number;
    relevanceScore: number;
    contentParts: Set<string>;
  }>();

  for (const chunk of chunks) {
    const existing = sourcesByDocument.get(chunk.documentId);
    if (existing) {
      if (!existing.fileName && chunk.fileName) existing.fileName = chunk.fileName;
      if (!existing.contentParts.has(chunk.content)) {
        existing.contentParts.add(chunk.content);
        existing.content = [...existing.contentParts].join("\n\n");
      }
      if (chunk.pageStart !== undefined) {
        existing.pageStart = existing.pageStart === undefined
          ? chunk.pageStart
          : Math.min(existing.pageStart, chunk.pageStart);
      }
      if (chunk.pageEnd !== undefined) {
        existing.pageEnd = existing.pageEnd === undefined
          ? chunk.pageEnd
          : Math.max(existing.pageEnd, chunk.pageEnd);
      }
      existing.matchedChunks += 1;
      existing.relevanceScore = Math.max(existing.relevanceScore, chunk.score);
      continue;
    }

    sourcesByDocument.set(chunk.documentId, {
      documentId: chunk.documentId,
      fileName: chunk.fileName,
      content: chunk.content,
      pageStart: chunk.pageStart,
      pageEnd: chunk.pageEnd,
      matchedChunks: 1,
      relevanceScore: chunk.score,
      contentParts: new Set([chunk.content]),
    });
  }

  const sources = [...sourcesByDocument.values()].map((source) => ({
    documentId: source.documentId,
    fileName: source.fileName,
    content: source.content,
    pageStart: source.pageStart,
    pageEnd: source.pageEnd,
    matchedChunks: source.matchedChunks,
    relevanceScore: source.relevanceScore,
  }));

  const prompt = createRagPrompt(question, chunks);
  const answer = await generateAnswer(prompt);

  return {
    question,
    answer,
    sources,
    retrievedChunks: chunks.length,
  };
}
