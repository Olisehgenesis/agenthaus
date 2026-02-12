import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BETA_CREATE_SYSTEM_PROMPT } from "@/lib/beta/system-prompt";
import { listTemplates, createAgent, getMyAgents } from "@/lib/beta/tools";
import { getFirstAvailableProviderAndKey } from "@/lib/api-keys";
import { getDefaultModel } from "@/lib/llm";
import { chat } from "@/lib/llm";
import type { AgentTemplate } from "@/lib/types";

const OPENROUTER_FALLBACK_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "mistralai/mistral-small-3.1-24b-instruct:free",
  "qwen/qwen3-4b:free",
  "deepseek/deepseek-r1-0528:free",
];

/**
 * POST /api/beta/chat
 * Chat API for Beta Create — create and deploy agents via natural language.
 * @see docs/BETA_CREATE_PLAN.md
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      message,
      conversationHistory = [],
      walletAddress,
      imageBase64,
    } = body;

    if (!walletAddress || !message?.trim()) {
      return NextResponse.json({
        response: "Please connect your wallet to create or deploy agents.",
      });
    }

    // Resolve user (create if needed) and get API key
    let user = await prisma.user.findUnique({
      where: { walletAddress },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress },
      });
    }

    const keyResult = await getFirstAvailableProviderAndKey(user.id);
    if (!keyResult) {
      return NextResponse.json({
        response:
          "No LLM API key configured. Go to **Settings** in the dashboard and add your OpenRouter API key (free tier available at openrouter.ai).",
      });
    }

    const { apiKey, provider } = keyResult;
    let model = getDefaultModel(provider);
    if (provider === "openrouter") {
      model = model || "meta-llama/llama-3.3-70b-instruct:free";
    }

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: BETA_CREATE_SYSTEM_PROMPT },
      ...conversationHistory.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message.trim() },
    ];

    let response = await callLLM(messages, provider, model, apiKey);

    // Parse for tool calls
    const listMatch = response.match(/\[\[LIST_TEMPLATES\]\]/);
    const createMatch = response.match(/\[\[CREATE_AGENT\|([^|]+)\|([a-z]+)\]\]/);
    const myAgentsMatch = response.match(/\[\[GET_MY_AGENTS\]\]/);

    if (listMatch) {
      const templates = listTemplates();
      messages.push(
        { role: "assistant", content: response },
        {
          role: "user",
          content: `[Tool result - list_templates]\n${templates}\n\nSummarize these templates for the user in a friendly way.`,
        }
      );
      response = await callLLM(messages, provider, model, apiKey);
    } else if (createMatch) {
      const agentName = createMatch[1].trim();
      const templateType = createMatch[2] as AgentTemplate;
      const validTypes: AgentTemplate[] = ["payment", "trading", "forex", "social", "custom"];
      if (!validTypes.includes(templateType)) {
        return NextResponse.json({
          response: `Invalid template type "${templateType}". Use one of: payment, trading, forex, social, custom.`,
        });
      }
      const result = await createAgent({
        name: agentName,
        templateType,
        ownerAddress: walletAddress,
      });
      return NextResponse.json({
        response: `${agentName} is created! Click **Sign to Register ERC-8004** below to register it on-chain. After signing, your agent will be active.`,
        needsSign: true,
        agentId: result.agentId,
        agentName: result.agentName,
        link: result.link,
      });
    } else if (myAgentsMatch) {
      const data = await getMyAgents(walletAddress);
      const toolResult = JSON.stringify(data, null, 2);
      messages.push(
        { role: "assistant", content: response },
        {
          role: "user",
          content: `[Tool result - get_my_agents]\n${toolResult}\n\nSummarize the user's agents and stats in a friendly way. If they have no agents, suggest they create one.`,
        }
      );
      response = await callLLM(messages, provider, model, apiKey);
    }

    return NextResponse.json({ response });
  } catch (err) {
    console.error("[api/beta/chat]", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        response: msg.includes("API key")
          ? "No LLM API key configured. Go to **Settings** and add your OpenRouter API key."
          : `Something went wrong: ${msg}`,
      },
      { status: 500 }
    );
  }
}

async function callLLM(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  provider: "openrouter" | "openai" | "groq" | "grok" | "gemini" | "deepseek" | "zai",
  model: string,
  apiKey: string
): Promise<string> {
  let lastError: Error | null = null;

  if (provider === "openrouter" && model.endsWith(":free")) {
    const fallbacks = [
      model,
      ...OPENROUTER_FALLBACK_MODELS.filter((m) => m !== model),
    ];
    for (const m of fallbacks) {
      try {
        const res = await chat(messages, provider, m, apiKey);
        return res.content;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
        if (!lastError.message.includes("429") && !lastError.message.includes("400")) {
          throw lastError;
        }
      }
    }
    throw lastError || new Error("LLM request failed");
  }

  const res = await chat(messages, provider, model, apiKey);
  return res.content;
}
