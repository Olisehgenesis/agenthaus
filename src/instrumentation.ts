/**
 * Next.js Instrumentation Hook
 * 
 * Runs once when the server starts.
 * We use this to synchronize all Telegram webhooks.
 */

export async function register() {
    // Only run on the server
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { syncAllWebhooks } = await import("@/lib/channels/telegram");

        console.log("🚀 Server starting: Synchronizing webhooks...");
        try {
            await syncAllWebhooks();
            console.log("✅ Webhook synchronization complete.");
        } catch (error) {
            console.error("❌ Failed to synchronize webhooks:", error);
        }
    }
}
