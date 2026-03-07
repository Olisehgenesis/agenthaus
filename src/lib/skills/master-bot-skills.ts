/**
 * Specialized Skills for the Master Bot
 */

import { prisma } from "@/lib/db";
import { deriveAddress, getNextDerivationIndex } from "@/lib/blockchain/wallet";

/**
 * Onboard a user: ensure they have a User record and a wallet.
 */
export async function onboardUser(telegramId: string, username?: string, email?: string) {
    console.log(`[Onboarding] Starting for Telegram ID: ${telegramId}`);
    let user = await prisma.user.findUnique({
        where: { telegramId: String(telegramId) }
    });

    if (!user) {
        // Check if user exists by email if provided
        if (email) {
            user = await prisma.user.findUnique({ where: { email } });
            if (user) {
                // Link existing user to Telegram
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: { telegramId: String(telegramId), telegramUsername: username }
                });
            }
        }

        if (!user) {
            console.log(`[Onboarding] Creating new user for: ${telegramId}`);
            // Generate a wallet for the new user
            const index = await getNextDerivationIndex();
            const address = deriveAddress(index);

            // Create new user
            user = await prisma.user.create({
                data: {
                    telegramId: String(telegramId),
                    telegramUsername: username,
                    email: email || `tg_${telegramId}@agenthaus.space`,
                    walletAddress: address,
                    walletDerivationIndex: index
                }
            });
        }
    }

    // Ensure existing users without a wallet get one (migration/edge case)
    if (user && !user.walletAddress) {
        console.log(`[Onboarding] Assigning wallet to existing user: ${telegramId}`);
        const index = await getNextDerivationIndex();
        const address = deriveAddress(index);
        user = await prisma.user.update({
            where: { id: user.id },
            data: {
                walletAddress: address,
                walletDerivationIndex: index
            }
        });
    }

    return user;
}

/**
 * Create a specialized derived wallet for a user.
 */
export async function createUserWallet(userId: string) {
    const user = await (prisma.user as any).findUnique({
        where: { id: userId }
    });

    if (!user) throw new Error("User not found");
    if (user.walletAddress) return { address: user.walletAddress, index: user.walletDerivationIndex };

    const index = await getNextDerivationIndex();
    const address = deriveAddress(index);

    await (prisma.user as any).update({
        where: { id: userId },
        data: { walletAddress: address, walletDerivationIndex: index }
    });

    return { address, index };
}

/**
 * Quick deploy an agent from a text prompt.
 */
export async function quickDeployAgent(userId: string, name: string, prompt: string, template: string = "payment") {
    const index = await getNextDerivationIndex();
    const address = deriveAddress(index);

    const agent = await prisma.agent.create({
        data: {
            ownerId: userId,
            name,
            systemPrompt: prompt,
            templateType: template,
            status: "active",
            agentWalletAddress: address,
            walletDerivationIndex: index,
            spendingLimit: 100,
        }
    });

    return agent;
}
