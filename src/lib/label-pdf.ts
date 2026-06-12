import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { tagQrPayload, tagPrintLines } from "./load-tag";

// DK-2205 continuous tape: 62mm wide. We cut at 35mm.
const W_MM = 62;
const H_MM = 35;
const MM = 2.83465; // points per mm

export async function generateLabelPdf(
  orderNumber: string,
  loadNumber: number,
  numberOfLoads: number
): Promise<Uint8Array> {
  const W = W_MM * MM;
  const H = H_MM * MM;

  const doc = await PDFDocument.create();
  const page = doc.addPage([W, H]);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  const payload = tagQrPayload(orderNumber, loadNumber, numberOfLoads);
  const { line1, line2 } = tagPrintLines(orderNumber, loadNumber, numberOfLoads);

  const qrBuffer: Buffer = await QRCode.toBuffer(payload, {
    type: "png",
    margin: 0,
    width: 200,
    errorCorrectionLevel: "M",
  });
  const qrImage = await doc.embedPng(qrBuffer);

  const QR = 27 * MM;
  const MARGIN = 2 * MM;
  const TEXT_X = MARGIN + 1;

  // QR: right-aligned, vertically centered
  page.drawImage(qrImage, {
    x: W - QR - MARGIN,
    y: (H - QR) / 2,
    width: QR,
    height: QR,
  });

  // line1 (YYYYMMDD-)
  page.drawText(line1, {
    x: TEXT_X,
    y: H - MARGIN - 14,
    size: 14,
    font,
    color: rgb(0, 0, 0),
  });

  // line2 (0001 L1 / 4)
  page.drawText(line2, {
    x: TEXT_X,
    y: H - MARGIN - 14 - 5 - 12,
    size: 12,
    font,
    color: rgb(0, 0, 0),
  });

  return doc.save();
}
