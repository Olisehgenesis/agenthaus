/**
 * GET /api/random-avatar — Serve a random image from public/images
 * Used as fallback when agent has no image.
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const IMAGES_DIR = path.join(process.cwd(), "public", "images");

export async function GET() {
  try {
    const files = fs.readdirSync(IMAGES_DIR).filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f));
    if (files.length === 0) {
      return new NextResponse(null, { status: 404 });
    }
    const random = files[Math.floor(Math.random() * files.length)];
    const buffer = fs.readFileSync(path.join(IMAGES_DIR, random));
    const ext = path.extname(random).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/webp";
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
