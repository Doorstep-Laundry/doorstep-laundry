import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const releases = await prisma.appRelease.findMany({
    orderBy: { uploadedAt: "desc" },
    select: { id: true, version: true, versionCode: true, fileName: true, size: true, notes: true, uploadedAt: true, uploadedBy: true },
  });

  return NextResponse.json(releases);
}
