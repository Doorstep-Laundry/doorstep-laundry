import { NextResponse } from "next/server";
import { getDriverSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getDriverSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  await prisma.printJob.update({
    where: { id: jobId, status: "claimed" },
    data: { status: "pending" },
  });

  return NextResponse.json({ ok: true });
}
