/**
 * Server-side QR code generation
 * Uses qrcode package for PNG output
 */

import QRCode from "qrcode";

const MAX_LENGTH = 2000;

export async function generateQRDataUrl(content: string): Promise<string> {
  if (!content || content.length > MAX_LENGTH) {
    throw new Error(`Content must be 1-${MAX_LENGTH} characters`);
  }
  return QRCode.toDataURL(content, {
    type: "image/png",
    margin: 2,
    width: 256,
    errorCorrectionLevel: "M",
  });
}
