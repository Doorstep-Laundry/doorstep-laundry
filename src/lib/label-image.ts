import sharp from "sharp";
import QRCode from "qrcode";
import { tagQrPayload, tagPrintLines } from "./load-tag";
import { PT_DOTS_W } from "./pt-print";

// DK-2205: 62mm wide, cut at 35mm. Printer-native resolution is 300 DPI.
export const LABEL_DOT_W = PT_DOTS_W; // 720
export const LABEL_DOT_H = Math.round((35 * 300) / 25.4); // 413

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Returns a 300 DPI PNG at 720 × 413 px (62mm × 35mm DK-2205 label).
 * Text on the left, QR code vertically centred on the right.
 */
export async function generateLabelPng(
  orderNumber: string,
  loadNumber: number,
  numberOfLoads: number
): Promise<Buffer> {
  const W = LABEL_DOT_W; // 720
  const H = LABEL_DOT_H; // 413

  const payload = tagQrPayload(orderNumber, loadNumber, numberOfLoads);
  const { line1, line2 } = tagPrintLines(orderNumber, loadNumber, numberOfLoads);

  // At 300 DPI: 2mm ≈ 24px, 27mm ≈ 319px
  const MARGIN = Math.round((2 * 300) / 25.4);   // 24 px
  const QR_SIZE = Math.round((27 * 300) / 25.4); // 319 px

  const qrPng = await (QRCode.toBuffer as (data: string, opts: object) => Promise<Buffer>)(
    payload,
    { type: "png", margin: 0, width: QR_SIZE, errorCorrectionLevel: "M" }
  );
  const qrBase64 = qrPng.toString("base64");

  const textX = MARGIN + 8;
  const fontSize1 = Math.round((5 * 300) / 25.4);   // ~59 px
  const fontSize2 = Math.round((4.5 * 300) / 25.4); // ~53 px
  const line1Y = MARGIN + fontSize1;
  const line2Y = line1Y + Math.round((2 * 300) / 25.4) + fontSize2;

  const qrX = W - QR_SIZE - MARGIN;
  const qrY = Math.round((H - QR_SIZE) / 2);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  <text x="${textX}" y="${line1Y}" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize1}" font-weight="bold" fill="black">${escapeXml(line1)}</text>
  <text x="${textX}" y="${line2Y}" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize2}" font-weight="bold" fill="black">${escapeXml(line2)}</text>
  <image x="${qrX}" y="${qrY}" width="${QR_SIZE}" height="${QR_SIZE}" href="data:image/png;base64,${qrBase64}"/>
</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
