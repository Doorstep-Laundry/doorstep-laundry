import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendOrderNotification } from "@/lib/notify";

/**
 * POST: Start a pickup run. Transition selected scheduled orders to picked_up
 * and set all their loads to status "picked_up".
 * Body: { orderIds: string[] }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!isStaff(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { orderIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderIds = body.orderIds;
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "orderIds array required" }, { status: 400 });
  }

  const userId = (session.user as { id: string }).id;

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { orderLoads: true },
  });

  if (orders.length !== orderIds.length) {
    return NextResponse.json({ error: "Some orders not found" }, { status: 404 });
  }

  for (const order of orders) {
    if (order.status !== "scheduled") {
      return NextResponse.json(
        { error: `Order ${order.orderNumber} must be scheduled (current: ${order.status}).` },
        { status: 400 }
      );
    }
  }

  for (const order of orders) {
    const orderId = order.id;
    const existingLoads = order.orderLoads ?? [];
    const needLoads = order.numberOfLoads - existingLoads.length;

    if (needLoads > 0) {
      for (let n = existingLoads.length + 1; n <= order.numberOfLoads; n++) {
        await prisma.orderLoad.create({
          data: {
            orderId,
            loadNumber: n,
            loadCode: `${order.orderNumber}-L${n}`,
            status: "picked_up",
          },
        });
      }
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "picked_up" },
    });
    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: "picked_up",
        note: "Pickup run started (driver)",
        changedById: userId,
      },
    });
    await prisma.orderLoad.updateMany({
      where: { orderId },
      data: { status: "picked_up" },
    });
    await sendOrderNotification(orderId, "picked_up").catch((e) =>
      console.error("Notify picked_up:", e)
    );
  }

  return NextResponse.json({ ok: true, orderIds });
}
