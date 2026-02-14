/**
 * Agent image API
 *
 * POST — Upload: compress to PNG, upload to Cloudinary (if CLOUDINARY_URL set)
 *        or store base64 in DB. Returns public URL for metadata/ERC-8004.
 *        Accepts: multipart/form-data with "file" OR application/json with imageBase64
 * GET  — Serve: return image from DB (for legacy /images/... URLs via rewrite)
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadAgentImageFromBuffer } from "@/lib/agent-image";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    let buffer: Buffer;
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      const imageBase64 = body?.imageBase64;
      if (!imageBase64 || typeof imageBase64 !== "string") {
        return NextResponse.json(
          { error: "imageBase64 required (data URL or raw base64)" },
          { status: 400 }
        );
      }
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      buffer = Buffer.from(base64Data, "base64");
      if (buffer.length > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Image must be under 5MB" },
          { status: 400 }
        );
      }
    } else {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file || !file.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Valid image file required (PNG, JPEG, WebP, etc.)" },
          { status: 400 }
        );
      }
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Image must be under 5MB" },
          { status: 400 }
        );
      }
      buffer = Buffer.from(await file.arrayBuffer());
    }

    const { imageUrl } = await uploadAgentImageFromBuffer(id, buffer);
    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Image upload failed:", error);
    const msg = error instanceof Error ? error.message : "Image upload failed";
    return NextResponse.json(
      { error: msg.includes("not found") ? msg : "Image upload failed" },
      { status: msg.includes("not found") ? 404 : 500 }
    );
  }
}
