/**
 * Groq LLM Provider
 * Ultra-fast inference via OpenAI-compatible API
 * https://console.groq.com/docs
 */

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

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
  model: string = "llama-3.3-70b-versatile",
  apiKey?: string
): Promise<ChatCompletionResponse> {
  const key = apiKey || process.env.GROQ_API_KEY;

  if (!key) {
    throw new Error(
      "Groq API key not configured. Add your Groq API key in Settings."
    );
  }

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
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
    throw new Error(`Groq API error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Stream chat completion from Groq
 */
export async function chatCompletionStream(
  messages: ChatMessage[],
  model: string = "llama-3.3-70b-versatile",
  apiKey?: string
): Promise<ReadableStream<Uint8Array>> {
  const key = apiKey || process.env.GROQ_API_KEY;

  if (!key) {
    throw new Error("Groq API key not configured.");
  }

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
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
    throw new Error(`Groq stream error (${response.status}): ${error}`);
  }

  return response.body!;
}

// Available Groq models
export const GROQ_MODELS = [
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
  { id: "llama-3.2-90b-vision-preview", name: "Llama 3.2 90B Vision" },
  { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
  { id: "gemma2-9b-it", name: "Gemma 2 9B" },
  { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Distill 70B" },
] as const;

