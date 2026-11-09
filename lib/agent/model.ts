import type { LanguageModelV1 } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";

/**
 * Pick whichever LLM provider has a key configured. Override the model with
 * LLM_MODEL. Returns null when no key is set - the app then falls back to the
 * deterministic rules engine so the demo still runs.
 */
export function getModel(): { model: LanguageModelV1; label: string } | null {
  const override = process.env.LLM_MODEL;
  if (process.env.ANTHROPIC_API_KEY) {
    const id = override || "claude-sonnet-4-5";
    return { model: createAnthropic()(id), label: `Anthropic ${id}` };
  }
  if (process.env.OPENAI_API_KEY) {
    const id = override || "gpt-4.1-mini";
    return { model: createOpenAI()(id), label: `OpenAI ${id}` };
  }
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const id = override || "gemini-2.5-flash";
    return { model: createGoogleGenerativeAI()(id), label: `Google ${id}` };
  }
  if (process.env.GROQ_API_KEY) {
    const id = override || "llama-3.3-70b-versatile";
    return { model: createGroq()(id), label: `Groq ${id}` };
  }
  return null;
}
