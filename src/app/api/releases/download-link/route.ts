import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getDriverSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";

function getSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET not set");
  return new TextEncoder().encode(secret);
}

export async function GET(request: Request) {
  const driver = await getDriverSession(request);
  if (!driver) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const release = await prisma.appRelease.findFirst({
    orderBy: { uploadedAt: "desc" },
    select: { id: true },
  });
  if (!release) return NextResponse.json({ error: "No release available" }, { status: 404 });

  const token = await new SignJWT({ type: "apk-download", releaseId: release.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getSecret());

  const origin = new URL(request.url).origin;
  return NextResponse.json({ url: `${origin}/api/releases/download?token=${token}` });
}
