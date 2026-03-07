/**
 * Interactive Deployment Flow
 * 
 * This skill handles the multi-step process of gathering agent details
 * and deploying it on-chain.
 */

import { prisma } from "@/lib/db";
import { sendMessage } from "@/lib/channels/telegram";
import { quickDeployAgent } from "./master-bot-skills";

export async function handleInteractiveDeploy(token: string, chatId: number, userId: string, text: string) {
    // If text is just "/deploy", ask for a name
    if (text.toLowerCase() === "/deploy") {
        return sendMessage(token, chatId, "🏷 What would you like to name your new agent?");
    }

    // Very simple state machine or AI-driven?
    // User wants "do agents from telegram".
    // Let's use a simple heuristic for now or prompt the user for a summary.

    if (text.split(" ").length < 3) {
        return sendMessage(token, chatId, "📝 Please describe what you want the agent to do in a few sentences.");
    }

    // If we have enough info, try a quick deploy
    try {
        const name = text.split("\n")[0].slice(0, 30);
        const agent = await quickDeployAgent(userId, name, text);

        return sendMessage(token, chatId, `🚀 **Agent Deployed!**

Name: **${agent.name}**
Wallet: \`${agent.agentWalletAddress}\`
Status: **Active**

You can now start talking to it! Use /agents to see its details.`);
    } catch (err) {
        console.error("Deploy failed:", err);
        return sendMessage(token, chatId, "❌ Failed to deploy agent. Please try again later.");
    }
}
