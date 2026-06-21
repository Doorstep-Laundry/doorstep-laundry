import { NextResponse } from "next/server";
import { getDriverSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";
import { sendOrderNotification } from "@/lib/notify";

/**
 * POST: Start a pickup run. Transition selected scheduled orders to out_for_pickup.
 * Loads are NOT moved yet — load counts and statuses are confirmed when the driver
 * arrives at the customer via POST /api/driver/confirm-pickup.
 * Body: { orderIds: string[] }
 */
export async function POST(request: Request) {
  const driver = await getDriverSession(request);
  if (!driver) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const userId = driver.id;

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
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
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "out_for_pickup" },
    });
    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: "out_for_pickup",
        note: "Pickup route started (driver)",
        changedById: userId,
      },
    });
    await sendOrderNotification(orderId, "out_for_pickup").catch((e) =>
      console.error("Notify out_for_pickup:", e)
    );
  }

  return NextResponse.json({ ok: true, orderIds });
}
