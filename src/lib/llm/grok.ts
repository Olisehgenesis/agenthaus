/**
 * Grok (xAI) LLM Provider
 * OpenAI-compatible API at https://api.x.ai/v1
 * https://console.x.ai/
 */

const GROK_BASE_URL = "https://api.x.ai/v1";

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
  model: string = "grok-3-mini-fast",
  apiKey?: string
): Promise<ChatCompletionResponse> {
  const key = apiKey || process.env.GROK_API_KEY;

  if (!key) {
    throw new Error(
      "Grok API key not configured. Add your xAI API key in Settings."
    );
  }

  const response = await fetch(`${GROK_BASE_URL}/chat/completions`, {
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
    throw new Error(`Grok API error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Stream chat completion from Grok
 */
export async function chatCompletionStream(
  messages: ChatMessage[],
  model: string = "grok-3-mini-fast",
  apiKey?: string
): Promise<ReadableStream<Uint8Array>> {
  const key = apiKey || process.env.GROK_API_KEY;

  if (!key) {
    throw new Error("Grok API key not configured.");
  }

  const response = await fetch(`${GROK_BASE_URL}/chat/completions`, {
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
    throw new Error(`Grok stream error (${response.status}): ${error}`);
  }

  return response.body!;
}

// Available Grok models
export const GROK_MODELS = [
  { id: "grok-3", name: "Grok 3" },
  { id: "grok-3-fast", name: "Grok 3 Fast" },
  { id: "grok-3-mini", name: "Grok 3 Mini" },
  { id: "grok-3-mini-fast", name: "Grok 3 Mini Fast" },
  { id: "grok-2", name: "Grok 2" },
] as const;

