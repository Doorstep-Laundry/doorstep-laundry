import { NextResponse } from "next/server";
import { getDriverSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const driver = await getDriverSession(request);
  if (!driver) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const release = await prisma.appRelease.findFirst({
    orderBy: { uploadedAt: "desc" },
    select: { id: true, version: true, versionCode: true, size: true, notes: true, uploadedAt: true },
  });

  if (!release) return NextResponse.json(null);
  return NextResponse.json(release);
}
