import { NextResponse } from "next/server";
import { handleUpdate } from "@/lib/channels/grammy-bot";

export const dynamic = "force-dynamic";

export const POST = handleUpdate;


export async function GET() {
    return NextResponse.json({ status: "ok", bot: "master" });
}
