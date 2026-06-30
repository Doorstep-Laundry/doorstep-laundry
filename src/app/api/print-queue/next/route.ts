import { NextResponse } from "next/server";
import { getDriverSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";

// Called by the Android PrintQueueService every few seconds.
// Atomically claims the oldest pending job to avoid double-printing.
export async function GET(request: Request) {
  const session = await getDriverSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await prisma.$transaction(async (tx) => {
    const pending = await tx.printJob.findFirst({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
    });
    if (!pending) return null;
    return tx.printJob.update({
      where: { id: pending.id },
      data: { status: "claimed" },
    });
  });

  return NextResponse.json({ job: job ?? null });
}
