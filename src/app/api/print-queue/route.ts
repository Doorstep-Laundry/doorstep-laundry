import { NextResponse } from "next/server";
import { getDriverSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getDriverSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { orderNumber?: unknown; loadNumber?: unknown; numberOfLoads?: unknown };
  const { orderNumber, loadNumber, numberOfLoads } = body;

  if (
    typeof orderNumber !== "string" ||
    typeof loadNumber !== "number" ||
    typeof numberOfLoads !== "number" ||
    loadNumber < 1 ||
    numberOfLoads < 1
  ) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const job = await prisma.printJob.create({
    data: { orderNumber, loadNumber, numberOfLoads },
  });

  return NextResponse.json({ jobId: job.id });
}
