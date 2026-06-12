import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isStaff } from "@/lib/auth";
import { generateLabelPng, LABEL_DOT_H } from "@/lib/label-image";
import { printLabelTcp } from "@/lib/pt-print";

/**
 * POST /api/driver/print-label
 *
 * Body: { orderNumber, loadNumber, numberOfLoads }
 *
 * Behaviour:
 *   1. If LABEL_PRINTER_URL is set (e.g. "tcp://192.168.1.x:9100") →
 *      send via PT-Touch raster over raw TCP. Returns { status: "printed" }.
 *   2. On failure or unset → return PNG as base64 so the client can open
 *      the AirPrint / browser print dialog. Returns { status: "png", data }.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!isStaff(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { orderNumber: string; loadNumber: number; numberOfLoads: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { orderNumber, loadNumber, numberOfLoads } = body;
  if (!orderNumber || typeof loadNumber !== "number" || typeof numberOfLoads !== "number") {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const png = await generateLabelPng(orderNumber, loadNumber, numberOfLoads);

  const printerUrl = process.env.LABEL_PRINTER_URL;
  if (printerUrl) {
    try {
      const url = new URL(printerUrl);
      if (url.protocol === "tcp:") {
        const port = url.port ? parseInt(url.port, 10) : 9100;
        await printLabelTcp(url.hostname, port, png, LABEL_DOT_H);
        return NextResponse.json({ status: "printed" });
      }
    } catch (err) {
      console.error("[print-label] TCP print failed, falling back to browser print:", err);
    }
  }

  // AirPrint / browser print fallback
  return NextResponse.json({ status: "png", data: png.toString("base64") });
}
