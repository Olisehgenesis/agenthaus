/**
 * GET /api/images/[slug] — Serve agent images from DB
 *
 * Used via rewrite: /images/agentname-xxxx.png → /api/images/agentname-xxxx.png
 * 8004scan and ERC-8004 metadata use https://agenthaus.space/images/agentname-xxxx.png
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  if (!slug) {
    return new NextResponse(null, { status: 404 });
  }

  const agent = await prisma.agent.findFirst({
    where: { imageSlug: slug },
    select: { imageDataBase64: true },
  });

  if (!agent?.imageDataBase64) {
    return new NextResponse(null, { status: 404 });
  }

  const buffer = Buffer.from(agent.imageDataBase64, "base64");
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
