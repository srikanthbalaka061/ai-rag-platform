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

  const sources = chunks.map((chunk) => ({
    documentId: chunk.documentId,
    fileName: chunk.fileName,
    content: chunk.content,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    chunkIndex: chunk.chunkIndex,
    relevanceScore: chunk.score,
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
