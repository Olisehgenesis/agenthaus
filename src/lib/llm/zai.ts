/**
 * Z.AI (Zhipu AI) LLM Provider
 * GLM-4 series models - free tier available
 * https://open.bigmodel.cn/
 */

const ZAI_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ZAIChatResponse {
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
  model: string = "glm-4-flash",
  apiKey?: string
): Promise<ZAIChatResponse> {
  const key = apiKey || process.env.ZAI_API_KEY;

  if (!key) {
    throw new Error("Z.AI API key not configured. Set ZAI_API_KEY in environment.");
  }

  const response = await fetch(`${ZAI_BASE_URL}/chat/completions`, {
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
    throw new Error(`Z.AI API error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Stream chat completion from Z.AI
 */
export async function chatCompletionStream(
  messages: ChatMessage[],
  model: string = "glm-4-flash",
  apiKey?: string
): Promise<ReadableStream<Uint8Array>> {
  const key = apiKey || process.env.ZAI_API_KEY;

  if (!key) {
    throw new Error("Z.AI API key not configured.");
  }

  const response = await fetch(`${ZAI_BASE_URL}/chat/completions`, {
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
    throw new Error(`Z.AI stream error (${response.status}): ${error}`);
  }

  return response.body!;
}

// Available Z.AI models
export const ZAI_MODELS = [
  { id: "glm-4-flash", name: "GLM-4 Flash (Free)" },
  { id: "glm-4-air", name: "GLM-4 Air" },
  { id: "glm-4-airx", name: "GLM-4 AirX" },
  { id: "glm-4-long", name: "GLM-4 Long" },
  { id: "glm-4", name: "GLM-4" },
] as const;

