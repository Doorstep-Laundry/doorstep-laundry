/**
 * Generate a PDF receipt for a paid order.
 * Used for download and as email attachment on payment_received.
 */

import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import type { CompanyInfo } from "./settings";
import type { LoadOptionsInput } from "./load-options";
import { getEnabledLoadOptionLabels } from "./load-options";
import type { BulkyItems } from "./bulky-items";
import {
  computeBulkyItemsCents,
  getAggregatedBulkyLineItems,
  normalizeBulkyItems,
} from "./bulky-items";

export type ReceiptOrder = {
  orderNumber: string;
  totalCents: number;
  createdAt: Date;
  pickupDate: Date;
  deliveryDate: Date;
  pickupTimeSlot: string | null;
  deliveryTimeSlot: string | null;
  customer: { name: string | null; email: string; phone?: string | null };
  pickupAddress: { street: string; city: string; state: string; zip: string };
  deliveryAddress: { street: string; city: string; state: string; zip: string };
  orderLoads: Array<{
    loadNumber: number;
    weightLbs: number | null;
    bulkyItems?: BulkyItems | unknown | null;
    creditedLoad?: boolean;
  } & Partial<LoadOptionsInput>>;
};

export type ReceiptOptions = {
  /** Effective price per pound in cents (e.g. 150 = $1.50). */
  pricePerPoundCents: number;
  grtPercent: number;
  /** When true, no NMGRT line or tax amount (e.g. non-profit). */
  nmgrtExempt?: boolean;
  company: CompanyInfo;
};

const MARGIN = 50;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const FONT_SIZE = 10;
const FONT_SIZE_SMALL = 9;
const FONT_SIZE_TITLE = 14;
const LINE_HEIGHT = 14;
const TABLE_HEADER_HEIGHT = 20;
const ROW_HEIGHT = 16;
const LABEL_GRAY = rgb(0.45, 0.45, 0.45);
const BORDER_GRAY = rgb(0.9, 0.9, 0.9);
const BLACK = rgb(0.1, 0.1, 0.1);
const PAID_STAMP_SIZE = 72;
const LOGO_MAX_HEIGHT = 80;
const LOGO_MAX_WIDTH = 240;

/** Pre-rendered full mark; avoids SVG text rasterizing as tofu on the server. */
const RECEIPT_V3_LOGO_PNG_PATH = "/doorstep/doorstep-laundry-logo-v3.png";

/** Icon-only fallback when no PNG exists for smaller wordmark SVGs. */
const RECEIPT_LOGO_ICON_PATH = "/doorstep/DL_icon_RGB.svg";

/** Full v3 logo: use PNG instead of SVG on receipts. */
const SVG_LOGO_MAP_TO_PNG_SUFFIXES = ["doorstep-laundry-logo-v3.svg"] as const;

/**
 * SVGs that embed typography — Sharp/librsvg often has no glyphs.
 * Use RECEIPT_LOGO_ICON_PATH and draw company name with standard PDF fonts.
 */
const SVG_LOGO_USE_ICON_ONLY_SUFFIXES = [
  "doorstep-logo-wordmark.svg",
  "doorstep-logo-subtext.svg",
  "DL_logo_horizontal_RGB-cropped.svg",
] as const;

function pathnameFromLogoUrl(logoUrl: string): string {
  try {
    if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
      return new URL(logoUrl).pathname.toLowerCase();
    }
  } catch {
    /* ignore */
  }
  return logoUrl.split("?")[0].toLowerCase();
}

function receiptRasterLogoUrl(companyLogoUrl: string): { fetchUrl: string; drawNameBeside: boolean } {
  const path = pathnameFromLogoUrl(companyLogoUrl);
  if (!path.endsWith(".svg")) {
    return { fetchUrl: companyLogoUrl, drawNameBeside: false };
  }
  if (SVG_LOGO_MAP_TO_PNG_SUFFIXES.some((s) => path.endsWith(s))) {
    return { fetchUrl: RECEIPT_V3_LOGO_PNG_PATH, drawNameBeside: false };
  }
  const useIcon = SVG_LOGO_USE_ICON_ONLY_SUFFIXES.some((s) => path.endsWith(s));
  if (useIcon) {
    return { fetchUrl: RECEIPT_LOGO_ICON_PATH, drawNameBeside: true };
  }
  return { fetchUrl: companyLogoUrl, drawNameBeside: false };
}

/** Standard 14 fonts only support WinAnsi; strip/replace chars that render as tofu. */
function sanitizeTextForStandardPdfFont(text: string): string {
  const normalized = text.normalize("NFKC");
  const replaced = normalized
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00A0/g, " ");
  return [...replaced]
    .filter((ch) => {
      const cp = ch.codePointAt(0)!;
      return (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff);
    })
    .join("")
    .trim();
}

function formatAddress(addr: { street: string; city: string; state: string; zip: string }): string {
  return `${addr.street}, ${addr.city}, ${addr.state} ${addr.zip}`;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

function formatDollars(cents: number): string {
  return (Math.round(cents) / 100).toFixed(2);
}

/** Allocate weight-based cents per load so the column sums to targetTotalCents. */
function allocateWeightCentsPerLoad(
  loads: Array<{ weightLbs: number | null }>,
  pricePerPoundCents: number,
  targetTotalCents: number
): number[] {
  const n = loads.length;
  if (n === 0) return [];
  const raw = loads.map((l) =>
    Math.round((Number(l.weightLbs) || 0) * pricePerPoundCents)
  );
  const sum = raw.reduce((a, b) => a + b, 0);
  const diff = targetTotalCents - sum;
  if (diff !== 0) {
    for (let i = n - 1; i >= 0; i--) {
      if ((Number(loads[i].weightLbs) || 0) > 0 || i === 0) {
        raw[i] += diff;
        break;
      }
    }
  }
  return raw;
}

async function fetchLogoImage(
  doc: PDFDocument,
  logoUrl: string
): Promise<{
  width: number;
  height: number;
  // Page type is permissive so we can pass PDFPage (its drawImage takes PDFImage, not unknown)
  draw: (page: { drawImage: (img: import("pdf-lib").PDFImage, opts: { x: number; y: number; width: number; height: number }) => void }, x: number, y: number) => void;
} | null> {
  const base =
    process.env.NEXTAUTH_URL && process.env.NEXTAUTH_URL.startsWith("http")
      ? process.env.NEXTAUTH_URL
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";
  const url = logoUrl.startsWith("http") ? logoUrl : `${base}${logoUrl}`;
  const isSvg = /\.svg$/i.test(logoUrl) || url.toLowerCase().includes(".svg");
  let bytes: ArrayBuffer;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    bytes = await res.arrayBuffer();
  } catch {
    return null;
  }
  let u8 = new Uint8Array(bytes);
  if (isSvg) {
    try {
      const sharp = (await import("sharp")).default;
      const pngBuffer = await sharp(Buffer.from(u8)).png().toBuffer();
      u8 = new Uint8Array(pngBuffer);
    } catch (e) {
      console.error("[receipt-pdf] SVG to PNG conversion failed:", e);
      return null;
    }
  }
  try {
    const image = await doc.embedPng(u8);
    const dims = image.scale(1);
    const scale = Math.min(LOGO_MAX_WIDTH / dims.width, LOGO_MAX_HEIGHT / dims.height, 1);
    const w = dims.width * scale;
    const h = dims.height * scale;
    return {
      width: w,
      height: h,
      draw(page, x, y) {
        page.drawImage(image, { x, y: y - h, width: w, height: h });
      },
    };
  } catch {
    try {
      const image = await doc.embedJpg(u8);
      const dims = image.scale(1);
      const scale = Math.min(LOGO_MAX_WIDTH / dims.width, LOGO_MAX_HEIGHT / dims.height, 1);
      const w = dims.width * scale;
      const h = dims.height * scale;
      return {
        width: w,
        height: h,
        draw(page, x, y) {
          page.drawImage(image, { x, y: y - h, width: w, height: h });
        },
      };
    } catch {
      return null;
    }
  }
}

export async function generateReceiptPdf(
  order: ReceiptOrder,
  options: ReceiptOptions
): Promise<Buffer> {
  const { pricePerPoundCents, grtPercent, nmgrtExempt = false, company } = options;
  const loads = order.orderLoads;
  const creditedLoads = loads.filter((l) => l.creditedLoad);
  const nonCreditedLoads = loads.filter((l) => !l.creditedLoad);

  // Use stored total (net of credits) to derive breakdown
  const { computeSubtotalAndTaxCents } = await import("./order-total");
  const { subtotalCents, taxCents } = computeSubtotalAndTaxCents(
    order.totalCents,
    grtPercent,
    nmgrtExempt
  );
  const totalCents = order.totalCents;
  const unitPricePerLbDollars = pricePerPoundCents / 100;
  const washDescription = "Wash and fold (by weight)";

  // For non-credited loads: allocate the paid subtotal proportionally
  const nonCreditedBulkyCents = nonCreditedLoads.reduce(
    (s, l) => s + computeBulkyItemsCents(l.bulkyItems as BulkyItems | null, pricePerPoundCents),
    0
  );
  const nonCreditedWeightLbs = nonCreditedLoads.reduce((s, l) => s + (Number(l.weightLbs) || 0), 0);
  const nonCreditedWeightFromLbs = Math.round(nonCreditedWeightLbs * pricePerPoundCents);
  let weightTargetCents = nonCreditedWeightFromLbs;
  if (nonCreditedWeightFromLbs + nonCreditedBulkyCents !== subtotalCents) {
    weightTargetCents = subtotalCents - nonCreditedBulkyCents;
  }
  const nonCreditedWeightCentsPerLoad = allocateWeightCentsPerLoad(
    nonCreditedLoads,
    pricePerPoundCents,
    weightTargetCents
  );

  // For credited loads: compute full price directly (shown then immediately offset)
  const creditedWeightCentsPerLoad = creditedLoads.map((l) =>
    Math.round((Number(l.weightLbs) || 0) * pricePerPoundCents)
  );
  const totalCreditedCents = creditedLoads.reduce((s, l, i) => {
    const bulky = computeBulkyItemsCents(l.bulkyItems as BulkyItems | null, pricePerPoundCents);
    return s + (creditedWeightCentsPerLoad[i] ?? 0) + bulky;
  }, 0);

  // Build a unified per-load cost map keyed by load index in the original array
  const weightCentsPerLoad: number[] = [];
  {
    let ncIdx = 0;
    let cIdx = 0;
    for (const l of loads) {
      if (l.creditedLoad) {
        weightCentsPerLoad.push(creditedWeightCentsPerLoad[cIdx++] ?? 0);
      } else {
        weightCentsPerLoad.push(nonCreditedWeightCentsPerLoad[ncIdx++] ?? 0);
      }
    }
  }

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const { width, height } = page.getSize();
  let y = height - MARGIN;

  // ----- Title: "SALES RECEIPT" centered -----
  const titleWidth = fontBold.widthOfTextAtSize("SALES RECEIPT", FONT_SIZE_TITLE);
  page.drawText("SALES RECEIPT", {
    x: (width - titleWidth) / 2,
    y,
    size: FONT_SIZE_TITLE,
    font: fontBold,
    color: BLACK,
  });
  y -= LINE_HEIGHT * 1.5;

  // ----- Top left: Logo or company name, then address, phone, email -----
  const leftCol = MARGIN;
  if (company.logoUrl) {
    const { fetchUrl, drawNameBeside } = receiptRasterLogoUrl(company.logoUrl);
    const logo = await fetchLogoImage(doc, fetchUrl);
    if (logo) {
      logo.draw(page, leftCol, y);
      if (drawNameBeside) {
        const nameSafe = sanitizeTextForStandardPdfFont(company.name);
        if (nameSafe) {
          const nameX = leftCol + logo.width + 12;
          const nameBaselineY = y - logo.height / 2 - FONT_SIZE * 0.35;
          page.drawText(nameSafe, {
            x: nameX,
            y: nameBaselineY,
            size: FONT_SIZE,
            font: fontBold,
            color: BLACK,
          });
        }
      }
      y -= logo.height + LINE_HEIGHT;
    } else {
      const nameSafe = sanitizeTextForStandardPdfFont(company.name);
      if (nameSafe) {
        page.drawText(nameSafe, {
          x: leftCol,
          y,
          size: FONT_SIZE,
          font: fontBold,
          color: BLACK,
        });
      }
      y -= LINE_HEIGHT;
    }
  } else if (company.name) {
    const nameSafe = sanitizeTextForStandardPdfFont(company.name);
    if (nameSafe) {
      page.drawText(nameSafe, { x: leftCol, y, size: FONT_SIZE, font: fontBold, color: BLACK });
    }
    y -= LINE_HEIGHT;
  }
  if (company.address) {
    const addressLines = company.address.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    for (const line of addressLines) {
      const lineSafe = sanitizeTextForStandardPdfFont(line);
      if (lineSafe) {
        page.drawText(lineSafe, { x: leftCol, y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
      }
      y -= LINE_HEIGHT;
    }
  }
  if (company.phone) {
    const phoneSafe = sanitizeTextForStandardPdfFont(company.phone);
    if (phoneSafe) {
      page.drawText(phoneSafe, { x: leftCol, y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
    }
    y -= LINE_HEIGHT;
  }
  if (company.email) {
    page.drawText(company.email, { x: leftCol, y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
    y -= LINE_HEIGHT;
  }

  // ----- Top right: DATE:, RECEIPT NO. (no CUSTOMER; Bill to has that) -----
  const rightCol = width - MARGIN - 140;
  let yRight = height - MARGIN - LINE_HEIGHT * 4;
  page.drawText("DATE:", { x: rightCol, y: yRight, size: FONT_SIZE_SMALL, font: font, color: LABEL_GRAY });
  page.drawText(formatDate(order.createdAt), { x: rightCol + 28, y: yRight, size: FONT_SIZE_SMALL, font: font, color: BLACK });
  yRight -= LINE_HEIGHT;
  page.drawText("RECEIPT NO.:", { x: rightCol, y: yRight, size: FONT_SIZE_SMALL, font: font, color: LABEL_GRAY });
  page.drawText(order.orderNumber, { x: rightCol + 65, y: yRight, size: FONT_SIZE_SMALL, font: font, color: BLACK });

  // ----- Bill to (payor): lower section, clearly separated -----
  y = Math.min(y, yRight) - LINE_HEIGHT * 4;
  page.drawText("Bill to:", { x: MARGIN, y, size: FONT_SIZE_SMALL, font: fontBold, color: LABEL_GRAY });
  y -= LINE_HEIGHT;
  const payorLines: string[] = [];
  if (order.customer.name?.trim()) payorLines.push(order.customer.name.trim());
  if (order.customer.email?.trim()) payorLines.push(order.customer.email.trim());
  if (order.customer.phone?.trim()) payorLines.push(order.customer.phone.trim());
  payorLines.push(formatAddress(order.deliveryAddress));
  for (const line of payorLines) {
    page.drawText(line, { x: MARGIN, y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
    y -= LINE_HEIGHT;
  }
  y -= LINE_HEIGHT * 0.5;

  // ----- Horizontal line -----
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: width - MARGIN, y },
    thickness: 0.5,
    color: BORDER_GRAY,
  });
  y -= LINE_HEIGHT;

  // ----- Itemized table header -----
  const colItem = MARGIN;
  const colDesc = MARGIN + 50;
  const colQty = width - MARGIN - 180;
  const colUnit = width - MARGIN - 120;
  const totalColRight = width - MARGIN - 5;

  page.drawText("ITEM NO.", { x: colItem, y, size: FONT_SIZE_SMALL, font: fontBold, color: LABEL_GRAY });
  page.drawText("DESCRIPTION", { x: colDesc, y, size: FONT_SIZE_SMALL, font: fontBold, color: LABEL_GRAY });
  page.drawText("QTY", { x: colQty, y, size: FONT_SIZE_SMALL, font: fontBold, color: LABEL_GRAY });
  page.drawText("UNIT PRICE", { x: colUnit, y, size: FONT_SIZE_SMALL, font: fontBold, color: LABEL_GRAY });
  page.drawText("TOTAL", { x: totalColRight - fontBold.widthOfTextAtSize("TOTAL", FONT_SIZE_SMALL), y, size: FONT_SIZE_SMALL, font: fontBold, color: LABEL_GRAY });
  y -= TABLE_HEADER_HEIGHT;

  const GREEN = rgb(0.05, 0.55, 0.1);
  for (let idx = 0; idx < loads.length; idx++) {
    const load = loads[idx];
    const lbs = Number(load.weightLbs) || 0;
    const loadWeightCents = weightCentsPerLoad[idx] ?? 0;
    const totalText = `$ ${formatDollars(loadWeightCents)}`;
    page.drawText(String(load.loadNumber), { x: colItem, y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
    page.drawText(washDescription, { x: colDesc, y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
    page.drawText(`${lbs.toFixed(1)} lbs`, { x: colQty, y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
    page.drawText(`$ ${unitPricePerLbDollars.toFixed(2)}`, { x: colUnit, y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
    page.drawText(totalText, { x: totalColRight - font.widthOfTextAtSize(totalText, FONT_SIZE_SMALL), y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
    y -= ROW_HEIGHT;
    const optionLabels = getEnabledLoadOptionLabels(load);
    if (optionLabels.length > 0) {
      const optsText = optionLabels.join(", ");
      page.drawText(optsText, { x: colDesc, y, size: FONT_SIZE_SMALL - 1, font: font, color: LABEL_GRAY });
      y -= ROW_HEIGHT * 0.75;
    }
    const bulkyLines = getAggregatedBulkyLineItems(
      normalizeBulkyItems(load.bulkyItems as BulkyItems | null),
      pricePerPoundCents
    );
    for (const bl of bulkyLines) {
      const bulkyDesc = `${bl.name} (bulky)`;
      const qtyStr = String(bl.qty);
      const unitStr = `$ ${formatDollars(bl.unitCents)}`;
      const lineTotalStr = `$ ${formatDollars(bl.lineCents)}`;
      page.drawText("", { x: colItem, y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
      page.drawText(bulkyDesc, { x: colDesc, y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
      page.drawText(qtyStr, { x: colQty, y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
      page.drawText(unitStr, { x: colUnit, y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
      page.drawText(lineTotalStr, {
        x: totalColRight - font.widthOfTextAtSize(lineTotalStr, FONT_SIZE_SMALL),
        y,
        size: FONT_SIZE_SMALL,
        font: font,
        color: BLACK,
      });
      y -= ROW_HEIGHT;
    }
    // If this load is credited, show a 100% discount line immediately after
    if (load.creditedLoad) {
      const loadFullCents = loadWeightCents +
        computeBulkyItemsCents(load.bulkyItems as BulkyItems | null, pricePerPoundCents);
      const creditLabel = "Free load credit (100% off)";
      const creditAmtText = `-$ ${formatDollars(loadFullCents)}`;
      page.drawText(creditLabel, { x: colDesc, y, size: FONT_SIZE_SMALL, font: font, color: GREEN });
      page.drawText(creditAmtText, {
        x: totalColRight - font.widthOfTextAtSize(creditAmtText, FONT_SIZE_SMALL),
        y,
        size: FONT_SIZE_SMALL,
        font: font,
        color: GREEN,
      });
      y -= ROW_HEIGHT;
    }
  }

  y -= LINE_HEIGHT;

  // ----- Summary: Subtotal, Load credits (if any), NMGRT (if not exempt), Total -----
  const sumLabelX = width - MARGIN - 130;
  const sumSubtotalText = `$ ${formatDollars(subtotalCents)}`;
  const sumTaxText = `$ ${formatDollars(taxCents)}`;
  const sumTotalText = `$ ${formatDollars(totalCents)}`;
  page.drawText("SUBTOTAL", { x: sumLabelX, y, size: FONT_SIZE_SMALL, font: font, color: LABEL_GRAY });
  page.drawText(sumSubtotalText, { x: totalColRight - font.widthOfTextAtSize(sumSubtotalText, FONT_SIZE_SMALL), y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
  y -= ROW_HEIGHT;

  if (totalCreditedCents > 0) {
    const creditTotalText = `-$ ${formatDollars(totalCreditedCents)}`;
    const creditLoadWord = creditedLoads.length === 1 ? "load" : "loads";
    page.drawText(`LOAD CREDITS (${creditedLoads.length} ${creditLoadWord})`, { x: sumLabelX, y, size: FONT_SIZE_SMALL, font: font, color: GREEN });
    page.drawText(creditTotalText, { x: totalColRight - font.widthOfTextAtSize(creditTotalText, FONT_SIZE_SMALL), y, size: FONT_SIZE_SMALL, font: font, color: GREEN });
    y -= ROW_HEIGHT;
  }

  if (!nmgrtExempt) {
    page.drawText(`NMGRT (${grtPercent}%)`, { x: sumLabelX, y, size: FONT_SIZE_SMALL, font: font, color: LABEL_GRAY });
    page.drawText(sumTaxText, { x: totalColRight - font.widthOfTextAtSize(sumTaxText, FONT_SIZE_SMALL), y, size: FONT_SIZE_SMALL, font: font, color: BLACK });
    y -= ROW_HEIGHT;
  }

  page.drawText("TOTAL", { x: sumLabelX, y, size: FONT_SIZE_SMALL, font: fontBold, color: BLACK });
  page.drawText(sumTotalText, { x: totalColRight - fontBold.widthOfTextAtSize(sumTotalText, FONT_SIZE_SMALL), y, size: FONT_SIZE_SMALL, font: fontBold, color: BLACK });
  y -= ROW_HEIGHT * 1.5;

  // ----- Thank you -----
  page.drawText("Thank you for your business.", { x: MARGIN, y, size: FONT_SIZE_SMALL, font: font, color: LABEL_GRAY });

  // ----- PAID stamp at 45° (drawn last so it overlays), centered on page -----
  const paidWidth = fontBold.widthOfTextAtSize("PAID", PAID_STAMP_SIZE);
  const cos45 = Math.cos(Math.PI / 4);
  const sin45 = Math.sin(Math.PI / 4);
  const stampX = width / 2 - (cos45 * (paidWidth / 2) - sin45 * (PAID_STAMP_SIZE / 2));
  const stampY = height / 2 - (sin45 * (paidWidth / 2) + cos45 * (PAID_STAMP_SIZE / 2));
  page.drawText("PAID", {
    x: stampX,
    y: stampY,
    size: PAID_STAMP_SIZE,
    font: fontBold,
    color: rgb(0.85, 0.2, 0.2),
    opacity: 0.4,
    rotate: degrees(45),
  });

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
