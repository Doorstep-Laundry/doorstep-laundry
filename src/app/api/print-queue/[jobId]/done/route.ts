import { NextResponse } from "next/server";
import { getDriverSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  const session = await getDriverSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.printJob.update({
    where: { id: params.jobId },
    data: { status: "done" },
  });

  return NextResponse.json({ ok: true });
}
