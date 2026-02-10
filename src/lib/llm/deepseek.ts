/**
 * DeepSeek LLM Provider
 * OpenAI-compatible API at https://api.deepseek.com
 * https://platform.deepseek.com/
 */

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

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
  model: string = "deepseek-chat",
  apiKey?: string
): Promise<ChatCompletionResponse> {
  const key = apiKey || process.env.DEEPSEEK_API_KEY;

  if (!key) {
    throw new Error(
      "DeepSeek API key not configured. Add your DeepSeek API key in Settings."
    );
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
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
    throw new Error(`DeepSeek API error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Stream chat completion from DeepSeek
 */
export async function chatCompletionStream(
  messages: ChatMessage[],
  model: string = "deepseek-chat",
  apiKey?: string
): Promise<ReadableStream<Uint8Array>> {
  const key = apiKey || process.env.DEEPSEEK_API_KEY;

  if (!key) {
    throw new Error("DeepSeek API key not configured.");
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
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
    throw new Error(`DeepSeek stream error (${response.status}): ${error}`);
  }

  return response.body!;
}

// Available DeepSeek models
export const DEEPSEEK_MODELS = [
  { id: "deepseek-chat", name: "DeepSeek V3 (Chat)" },
  { id: "deepseek-reasoner", name: "DeepSeek R1 (Reasoner)" },
] as const;

