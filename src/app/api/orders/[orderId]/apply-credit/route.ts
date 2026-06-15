import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ELIGIBLE_STATUSES = ["picked_up", "in_progress", "ready_for_delivery"];

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role: string }).role;
  if (role !== "customer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await params;

  const [order, user] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderLoads: { orderBy: { loadNumber: "asc" }, select: { id: true, weightLbs: true, creditedLoad: true } },
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { creditedLoads: true } }),
  ]);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.customerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!ELIGIBLE_STATUSES.includes(order.status)) {
    return NextResponse.json(
      { error: "Credits can only be applied to orders that are picked up, in progress, or ready for delivery" },
      { status: 400 }
    );
  }
  if (!user || user.creditedLoads <= 0) {
    return NextResponse.json({ error: "No credited loads available" }, { status: 400 });
  }

  const uncreditedLoads = order.orderLoads.filter((l) => !l.creditedLoad);
  if (uncreditedLoads.length === 0) {
    return NextResponse.json({ error: "All loads in this order already have a credit applied" }, { status: 400 });
  }

  // Pick the most expensive (heaviest) uncredited load; fall back to first if no weights
  const hasWeights = uncreditedLoads.some((l) => l.weightLbs != null && l.weightLbs > 0);
  let targetLoad = uncreditedLoads[0];
  if (hasWeights) {
    targetLoad = uncreditedLoads.reduce((best, l) =>
      (l.weightLbs ?? 0) > (best.weightLbs ?? 0) ? l : best
    );
  }

  await prisma.$transaction([
    prisma.orderLoad.update({ where: { id: targetLoad.id }, data: { creditedLoad: true } }),
    prisma.user.update({ where: { id: userId }, data: { creditedLoads: { decrement: 1 } } }),
  ]);

  return NextResponse.json({ success: true });
}
