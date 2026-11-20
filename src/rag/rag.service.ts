import { retrieveDocuments } from "../retrieval/retrieval.service.js";
import { createRagPrompt } from "./prompt.service.js";
import { generateAnswer } from "../llm/local-llm.service.js";

export interface AskQuestionInput {
  question: string;
  tenantId: string;
  topK?: number;
  scoreThreshold?: number;
}

export async function askQuestion(input: AskQuestionInput) {

  if (!input.question.trim()) {
    throw new Error("Question is required");
  }

  // STEP 1: Retrieve relevant chunks
  const chunks = await retrieveDocuments(
    input.question,
    {
      tenantId: input.tenantId,
      topK: input.topK ?? 5,
      scoreThreshold: input.scoreThreshold,
    }
  );

  if (chunks.length === 0) {
    return {
      question: input.question,
      answer: "I couldn't find relevant information in the available documents.",
      sources: [],
    };
  }

  const sources = chunks.map((chunk) => ({
    documentId: chunk.documentId,
    fileName: chunk.fileName,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    chunkIndex: chunk.chunkIndex,
    relevanceScore: chunk.score,
  }));

  const prompt = createRagPrompt(input.question, chunks);
  const answer = await generateAnswer(prompt);

  return {
    question: input.question,
    answer,
    sources,
    retrievedChunks: chunks.length,
  };
}