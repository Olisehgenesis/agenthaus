import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { uploadImageToIPFS, isPinataConfigured } from "@/lib/ipfs";

/**
 * POST /api/agents/:id/image — Upload agent image to IPFS and update agent.imageUrl
 * Body: multipart/form-data with "file" (image)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!isPinataConfigured()) {
      return NextResponse.json(
        { error: "IPFS (Pinata) not configured. Set PINATA_JWT in .env" },
        { status: 503 }
      );
    }

    const agent = await prisma.agent.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

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

    const ipfsUrl = await uploadImageToIPFS(file);
    await prisma.agent.update({
      where: { id },
      data: { imageUrl: ipfsUrl },
    });

    return NextResponse.json({ imageUrl: ipfsUrl });
  } catch (error) {
    console.error("Image upload failed:", error);
    return NextResponse.json({ error: "Image upload failed" }, { status: 500 });
  }
}
