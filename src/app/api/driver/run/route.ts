import { NextResponse } from "next/server";
import { getDriverSession } from "@/lib/mobile-auth";
import { prisma } from "@/lib/db";
import { sendOrderNotification } from "@/lib/notify";

const runOrderInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  pickupAddress: true,
  deliveryAddress: true,
  orderLoads: {
    orderBy: { loadNumber: "asc" as const },
    select: { id: true, loadNumber: true, status: true },
  },
} as const;

/**
 * GET: Current driver's active run (latest run with pickups or at least one delivery not delivered), or null.
 * Returns pickupOrders and deliveryOrders so the UI can show both (picked_up orders are not in the driver orders list).
 */
export async function GET(request: Request) {
  const driver = await getDriverSession(request);
  if (!driver) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const driverId = driver.id;
  const runs = await prisma.driverRun.findMany({
    where: { driverId },
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  for (const run of runs) {
    const orderIds = (run.orderIds as string[]) ?? [];
    const pickupOrderIds = (run.pickupOrderIds as string[] | null) ?? [];
    const hasPickups = pickupOrderIds.length > 0;
    const delivered = await prisma.order.count({
      where: { id: { in: orderIds }, status: "delivered" },
    });
    const deliveryActive = delivered < orderIds.length;
    if (hasPickups || deliveryActive) {
      const [pickupOrders, deliveryOrders] = await Promise.all([
        pickupOrderIds.length > 0
          ? prisma.order.findMany({
              where: { id: { in: pickupOrderIds } },
              include: runOrderInclude,
            })
          : [],
        orderIds.length > 0
          ? prisma.order.findMany({
              where: { id: { in: orderIds } },
              include: runOrderInclude,
            })
          : [],
      ]);
      const pickupOrdered = pickupOrderIds.map((id) => pickupOrders.find((o) => o.id === id)).filter(Boolean);
      const deliveryOrdered = orderIds.map((id) => deliveryOrders.find((o) => o.id === id)).filter(Boolean);
      return NextResponse.json({
        runId: run.id,
        orderIds,
        pickupOrderIds,
        startedAt: run.startedAt,
        pickupOrders: pickupOrdered,
        deliveryOrders: deliveryOrdered,
      });
    }
  }

  return NextResponse.json({ run: null });
}

/**
 * POST: Start a delivery run. Create DriverRun and set each order to out_for_delivery.
 * Body: { orderIds: string[], pickupOrderIds?: string[] } — pickupOrderIds optional (pickups already transitioned by start-pickup).
 */
export async function POST(request: Request) {
  const driver = await getDriverSession(request);
  if (!driver) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { orderIds?: string[]; pickupOrderIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orderIds = body.orderIds;
  const pickupOrderIds = Array.isArray(body.pickupOrderIds) ? body.pickupOrderIds : [];
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "orderIds array required" }, { status: 400 });
  }

  const driverId = driver.id;

  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    include: { orderLoads: true },
  });

  if (orders.length !== orderIds.length) {
    return NextResponse.json({ error: "Some orders not found" }, { status: 404 });
  }

  for (const order of orders) {
    if (order.status !== "ready_for_delivery") {
      return NextResponse.json(
        { error: `Order ${order.orderNumber} must be ready for delivery (current: ${order.status}). Only orders with all loads ready can be picked up.` },
        { status: 400 }
      );
    }
    const loads = order.orderLoads ?? [];
    if (loads.length === 0) {
      return NextResponse.json(
        { error: `Order ${order.orderNumber} has no loads` },
        { status: 400 }
      );
    }
    const allReady = loads.every((l) => l.status === "ready_for_delivery");
    if (!allReady) {
      return NextResponse.json(
        { error: `Order ${order.orderNumber} has loads not ready for delivery. All loads must be folded before pick up.` },
        { status: 400 }
      );
    }
  }

  const run = await prisma.driverRun.create({
    data: {
      driverId,
      orderIds,
      pickupOrderIds: pickupOrderIds.length > 0 ? pickupOrderIds : undefined,
    },
  });

  for (const orderId of orderIds) {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: "out_for_delivery" },
    });
    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: "out_for_delivery",
        note: "Out for delivery (run started)",
        changedById: driverId,
      },
    });
    await prisma.orderLoad.updateMany({
      where: { orderId },
      data: { status: "out_for_delivery", location: "Out for delivery" },
    });
    await sendOrderNotification(orderId, "out_for_delivery").catch((e) =>
      console.error("Notify out_for_delivery:", e)
    );
  }

  return NextResponse.json({
    runId: run.id,
    orderIds,
    pickupOrderIds: pickupOrderIds.length > 0 ? pickupOrderIds : [],
    startedAt: run.startedAt,
  });
}
