/**
 * Cloudinary configuration and upload helpers.
 * Uses CLOUDINARY_URL env var: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
 */

import { v2 as cloudinary } from "cloudinary";

function getConfig() {
  const url = process.env.CLOUDINARY_URL;
  if (!url) return null;
  cloudinary.config({ url });
  return cloudinary;
}

/** Upload a PNG buffer to Cloudinary. Returns secure_url or null. */
export async function uploadAgentImage(
  buffer: Buffer,
  publicId: string
): Promise<string | null> {
  const cld = getConfig();
  if (!cld) return null;

  const dataUri = `data:image/png;base64,${buffer.toString("base64")}`;
  const result = await cld.uploader.upload(dataUri, {
    public_id: publicId,
    overwrite: true,
    folder: "agenthaus/agents",
  });
  return result?.secure_url ?? null;
}

export function isCloudinaryConfigured(): boolean {
  return !!process.env.CLOUDINARY_URL;
}
