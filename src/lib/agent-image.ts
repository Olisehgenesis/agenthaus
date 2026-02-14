/**
 * Shared agent image upload logic.
 * Used by /api/agents/[id]/image and beta chat (create agent with attachment).
 */

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

export async function uploadAgentImageFromBuffer(
  agentId: string,
  buffer: Buffer
): Promise<{ imageUrl: string }> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, name: true },
  });
  if (!agent) {
    throw new Error("Agent not found");
  }

  const slug = `${sanitizeSlug(agent.name)}-${random4()}`;
  const filename = `${slug}.png`;

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
      where: { id: agentId },
      data: {
        imageUrl,
        imageSlug: filename,
        imageDataBase64: null,
      },
    });
  } else {
    const imageDataBase64 = compressed.toString("base64");
    imageUrl = `${BASE_URL}/images/${filename}`;

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        imageUrl,
        imageSlug: filename,
        imageDataBase64,
      },
    });
  }

  return { imageUrl };
}
