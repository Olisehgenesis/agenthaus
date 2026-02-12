/**
 * Agent image API
 *
 * POST — Upload: compress to PNG, upload to Cloudinary (if CLOUDINARY_URL set)
 *        or store base64 in DB. Returns public URL for metadata/ERC-8004.
 * GET  — Serve: return image from DB (for legacy /images/... URLs via rewrite)
 *
 * Body (POST): multipart/form-data with "file" (image)
 */

import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { DEPLOYMENT_URL } from "@/lib/constants";
import {
  uploadAgentImage,
  isCloudinaryConfigured,
} from "@/lib/cloudinary";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || DEPLOYMENT_URL;

const MAX_SIZE = 512;
const PNG_COMPRESSION = 9;

function sanitizeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "agent";
}

function random4(): string {
  return randomBytes(2).toString("hex");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      select: { id: true, name: true },
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

    const slug = `${sanitizeSlug(agent.name)}-${random4()}`;
    const filename = `${slug}.png`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const compressed = await sharp(buffer)
      .resize(MAX_SIZE, MAX_SIZE, { fit: "cover", position: "center" })
      .png({ compressionLevel: PNG_COMPRESSION })
      .toBuffer();

    let imageUrl: string;

    if (isCloudinaryConfigured()) {
      const cloudUrl = await uploadAgentImage(compressed, slug);
      if (!cloudUrl) {
        throw new Error("Cloudinary upload failed");
      }
      imageUrl = cloudUrl;

      await prisma.agent.update({
        where: { id },
        data: {
          imageUrl,
          imageSlug: filename,
          imageDataBase64: null, // No longer stored — served from Cloudinary
        },
      });
    } else {
      const imageDataBase64 = compressed.toString("base64");
      imageUrl = `${BASE_URL}/images/${filename}`;

      await prisma.agent.update({
        where: { id },
        data: {
          imageUrl,
          imageSlug: filename,
          imageDataBase64,
        },
      });
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Image upload failed:", error);
    return NextResponse.json({ error: "Image upload failed" }, { status: 500 });
  }
}
