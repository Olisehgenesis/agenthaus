/**
 * Google Gemini LLM Provider
 * OpenAI-compatible API at https://generativelanguage.googleapis.com/v1beta/openai/
 * https://aistudio.google.com/
 */

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai";

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
  model: string = "gemini-2.0-flash",
  apiKey?: string
): Promise<ChatCompletionResponse> {
  const key = apiKey || process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error(
      "Google Gemini API key not configured. Add your Gemini API key in Settings."
    );
  }

  const response = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
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
    throw new Error(`Gemini API error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Stream chat completion from Gemini
 */
export async function chatCompletionStream(
  messages: ChatMessage[],
  model: string = "gemini-2.0-flash",
  apiKey?: string
): Promise<ReadableStream<Uint8Array>> {
  const key = apiKey || process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("Google Gemini API key not configured.");
  }

  const response = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
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
    throw new Error(`Gemini stream error (${response.status}): ${error}`);
  }

  return response.body!;
}

// Available Gemini models
export const GEMINI_MODELS = [
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  { id: "gemini-2.0-flash-lite", name: "Gemini 2.0 Flash Lite" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
] as const;

