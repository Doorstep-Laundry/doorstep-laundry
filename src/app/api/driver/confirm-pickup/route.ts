import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendOrderNotification } from "@/lib/notify";

/**
 * POST: Confirm pickup at the customer's door. Transitions out_for_pickup → picked_up.
 * Driver provides the actual number of loads collected, which may differ from the
 * estimate given at booking. Loads are created/synced and set to picked_up.
 * Body: { orders: [{ orderId: string, numberOfLoads: number }] }
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

  let body: { orders?: { orderId: string; numberOfLoads: number }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.orders) || body.orders.length === 0) {
    return NextResponse.json({ error: "orders array required" }, { status: 400 });
  }

  const userId = (session.user as { id: string }).id;

  for (const item of body.orders) {
    if (!item.orderId || typeof item.numberOfLoads !== "number" || item.numberOfLoads < 1) {
      return NextResponse.json(
        { error: "Each entry requires orderId and numberOfLoads >= 1" },
        { status: 400 }
      );
    }
  }

  const orderIds = body.orders.map((o) => o.orderId);
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { orderLoads: true },
  });

  if (orders.length !== orderIds.length) {
    return NextResponse.json({ error: "Some orders not found" }, { status: 404 });
  }

  for (const order of orders) {
    if (order.status !== "out_for_pickup") {
      return NextResponse.json(
        { error: `Order ${order.orderNumber} must be out_for_pickup (current: ${order.status}).` },
        { status: 400 }
      );
    }
  }

  for (const { orderId, numberOfLoads } of body.orders) {
    const order = orders.find((o) => o.id === orderId)!;
    const existingLoads = order.orderLoads ?? [];

    // Update load count if driver picked up a different number than estimated
    const finalLoadCount = Math.max(1, numberOfLoads);

    // Create any missing load records
    if (finalLoadCount > existingLoads.length) {
      for (let n = existingLoads.length + 1; n <= finalLoadCount; n++) {
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

    // Remove excess load records if driver picked up fewer than estimated
    if (finalLoadCount < existingLoads.length) {
      const excess = [...existingLoads]
        .sort((a, b) => b.loadNumber - a.loadNumber)
        .slice(0, existingLoads.length - finalLoadCount);
      for (const load of excess) {
        await prisma.orderLoad.delete({ where: { id: load.id } });
      }
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "picked_up", numberOfLoads: finalLoadCount },
    });
    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: "picked_up",
        note: `Pickup confirmed (driver) — ${finalLoadCount} load(s)`,
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
