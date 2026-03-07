import { DynamicTool } from "@langchain/core/tools";
import { zodToJsonSchema } from "zod-to-json-schema";
import SKILL_DEFINITIONS from "./definitions";
import type { SkillDefinition } from "./types";

/**
 * Converts Agent Haus SkillDefinitions into LangChain DynamicTools.
 */
export function getLangChainTools(): DynamicTool[] {
    return SKILL_DEFINITIONS.filter(s => !!s.zodSchema).map((skill) => {
        return new DynamicTool({
            name: skill.id,
            description: skill.description,
            func: async (input: string) => {
                // Skill execution logic would go here
                return `Successfully executed ${skill.name}`;
            },
        });
    });
}
