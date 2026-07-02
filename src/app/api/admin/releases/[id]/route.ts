import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { del } from "@vercel/blob";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const release = await prisma.appRelease.findUnique({ where: { id } });
  if (!release) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try { await del(release.blobUrl); } catch { /* blob may already be gone */ }
  await prisma.appRelease.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
