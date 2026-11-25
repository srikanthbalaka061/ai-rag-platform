import { pipeline } from "@huggingface/transformers";
import { env } from "../config/env.js";

type TextGenerator = Awaited<
  ReturnType<typeof pipeline<"text2text-generation">>
>;

let generatorPromise: Promise<TextGenerator> | undefined;

function getGenerator(): Promise<TextGenerator> {
  if (!generatorPromise) {
    generatorPromise = pipeline(
      "text2text-generation",
      env.generationModel
    ).catch((error: unknown) => {
      generatorPromise = undefined;
      throw error;
    });
  }

  return generatorPromise;
}

export async function generateAnswer(prompt: string): Promise<string> {
  const generator = await getGenerator();
  const results = await generator(prompt, {
    max_new_tokens: 128,
    do_sample: false,
  });
  const answer = results[0]?.generated_text.trim();

  if (!answer) {
    throw new Error("The local generation model returned an empty answer");
  }

  return answer;
}

export async function initializeTextGenerator(): Promise<void> {
  await getGenerator();
}
