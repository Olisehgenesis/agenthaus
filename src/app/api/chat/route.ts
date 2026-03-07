import { streamText, tool } from "ai";
import { openai } from "@ai-sdk/openai";
import { zodToJsonSchema } from "zod-to-json-schema";
import SKILL_DEFINITIONS from "@/lib/skills/definitions";
import { logger } from "@/lib/logger";

export async function POST(req: Request) {
    const { messages } = await req.json();

    // Dynamically convert defined skills to AI SDK tools
    const tools: Record<string, any> = {};

    SKILL_DEFINITIONS.forEach((skill) => {
        if (skill.zodSchema) {
            tools[skill.id] = (tool as any)({
                description: skill.description,
                parameters: skill.zodSchema,
                execute: async (params: any) => {
                    logger.info({ skillId: skill.id, params }, "Executing skill via AI SDK");
                    return { status: "success", result: "Skill executed (scaffolded)" };
                },
            });
        }
    });



    const result = streamText({
        model: openai("gpt-4o"),
        messages,
        tools,
        system: "You are an AI agent on Celo. Use tools to interact with the blockchain.",
    });

    return result.toTextStreamResponse();
}

