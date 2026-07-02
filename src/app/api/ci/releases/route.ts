import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const ciSecret = process.env.CI_RELEASE_SECRET;
  if (!ciSecret || request.headers.get("x-ci-secret") !== ciSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as {
    version?: string;
    versionCode?: number;
    fileName?: string;
    blobUrl?: string;
    size?: number;
    notes?: string;
  };

  const { version, versionCode, fileName, blobUrl, size, notes } = body;
  if (!version || versionCode == null || !fileName || !blobUrl || size == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    await prisma.appRelease.create({
      data: { version, versionCode, fileName, blobUrl, size, notes: notes ?? null, uploadedBy: "ci" },
    });

    // Enforce 2-release cap
    const old = await prisma.appRelease.findMany({
      orderBy: { uploadedAt: "desc" },
      skip: 2,
    });
    for (const r of old) {
      try { await del(r.blobUrl); } catch { /* blob may already be gone */ }
      await prisma.appRelease.delete({ where: { id: r.id } });
    }
  } catch (e) {
    console.error("[ci/releases]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
