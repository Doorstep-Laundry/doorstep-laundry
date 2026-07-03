import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET not set");
  return new TextEncoder().encode(secret);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  let releaseId: string;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.type !== "apk-download" || typeof payload.releaseId !== "string") {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    releaseId = payload.releaseId;
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const release = await prisma.appRelease.findUnique({
    where: { id: releaseId },
    select: { blobUrl: true, fileName: true },
  });
  if (!release) return NextResponse.json({ error: "Release not found" }, { status: 404 });

  const blob = await fetch(release.blobUrl, {
    headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
  });
  if (!blob.ok) return NextResponse.json({ error: "Failed to fetch APK" }, { status: 502 });

  return new Response(blob.body, {
    headers: {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Disposition": `attachment; filename="${release.fileName}"`,
      ...(blob.headers.get("Content-Length") ? { "Content-Length": blob.headers.get("Content-Length")! } : {}),
    },
  });
}
