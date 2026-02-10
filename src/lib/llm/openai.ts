/**
 * OpenAI LLM Provider
 * GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo, o1 series
 * https://platform.openai.com/docs
 */

const OPENAI_BASE_URL = "https://api.openai.com/v1";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function chatCompletion(
  messages: ChatMessage[],
  model: string = "gpt-4o-mini",
  apiKey?: string
): Promise<ChatCompletionResponse> {
  const key = apiKey || process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error(
      "OpenAI API key not configured. Add your OpenAI API key in Settings."
    );
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Stream chat completion from OpenAI
 */
export async function chatCompletionStream(
  messages: ChatMessage[],
  model: string = "gpt-4o-mini",
  apiKey?: string
): Promise<ReadableStream<Uint8Array>> {
  const key = apiKey || process.env.OPENAI_API_KEY;

  if (!key) {
    throw new Error("OpenAI API key not configured.");
  }

  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI stream error (${response.status}): ${error}`);
  }

  return response.body!;
}

// Available OpenAI models
export const OPENAI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
  { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
  { id: "o1", name: "o1" },
  { id: "o1-mini", name: "o1 Mini" },
  { id: "o3-mini", name: "o3 Mini" },
] as const;

