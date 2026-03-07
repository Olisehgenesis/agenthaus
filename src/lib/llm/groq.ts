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

/**
 * Get the next available Groq API key from the environment.
 * Supports rotation/failover for up to 4 keys.
 */
function getGroqKeys(): string[] {
  const keys = [
    process.env.GROQ_API_KEY_1,
    process.env.GROQ_API_KEY_2,
    process.env.GROQ_API_KEY_3,
    process.env.GROQ_API_KEY_4,
    process.env.GROQ_API_KEY, // Legacy fallback
  ].filter(Boolean) as string[];

  return keys;
}

export async function chatCompletion(
  messages: ChatMessage[],
  model: string = "llama-3.3-70b-versatile",
  apiKey?: string
): Promise<ChatCompletionResponse> {
  const keys = apiKey ? [apiKey] : getGroqKeys();

  if (keys.length === 0) {
    throw new Error(
      "Groq API key not configured. Add GROQ_API_KEY_1 through GROQ_API_KEY_4 in .env"
    );
  }

  let lastError: Error | null = null;

  for (const key of keys) {
    try {
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
        const errorText = await response.text();
        const error = new Error(`Groq API error (${response.status}): ${errorText}`);

        // If rate limited, try next key
        if (response.status === 429 && !apiKey) {
          console.warn("⚠️ Groq rate limit hit, rotating key...");
          lastError = error;
          continue;
        }

        throw error;
      }

      return response.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // Only continue loop if it's a rate limit error (already handled above) 
      // or if we want to rotate on other transient errors.
      if (!apiKey && (lastError.message.includes("429") || lastError.message.includes("fetch failed"))) {
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error("All Groq API keys failed.");
}

/**
 * Stream chat completion from Groq
 */
export async function chatCompletionStream(
  messages: ChatMessage[],
  model: string = "llama-3.3-70b-versatile",
  apiKey?: string
): Promise<ReadableStream<Uint8Array>> {
  const keys = apiKey ? [apiKey] : getGroqKeys();

  if (keys.length === 0) {
    throw new Error("Groq API key not configured.");
  }

  let lastError: Error | null = null;

  for (const key of keys) {
    try {
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
        const errorText = await response.text();
        const error = new Error(`Groq stream error (${response.status}): ${errorText}`);

        if (response.status === 429 && !apiKey) {
          console.warn("⚠️ Groq rate limit hit during stream init, rotating key...");
          lastError = error;
          continue;
        }

        throw error;
      }

      return response.body!;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!apiKey && (lastError.message.includes("429") || lastError.message.includes("fetch failed"))) {
        continue;
      }
      throw lastError;
    }
  }

  throw lastError || new Error("All Groq API keys failed for streaming.");
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

