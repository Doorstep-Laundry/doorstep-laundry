import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** PATCH: Update number of loads on a promo code (admin only). Body: { numberOfLoads: number } */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role: string }).role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  let body: { numberOfLoads?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const numberOfLoads =
    typeof body.numberOfLoads === "number" ? Math.floor(body.numberOfLoads) : NaN;
  if (isNaN(numberOfLoads) || numberOfLoads < 1)
    return NextResponse.json({ error: "numberOfLoads must be ≥ 1" }, { status: 400 });

  try {
    const updated = await prisma.promoCode.update({
      where: { id },
      data: { numberOfLoads },
      include: { _count: { select: { redemptions: true } } },
    });
    const { _count, ...rest } = updated;
    return NextResponse.json({ ...rest, redemptionCount: _count.redemptions });
  } catch {
    return NextResponse.json({ error: "Promo code not found" }, { status: 404 });
  }
}
