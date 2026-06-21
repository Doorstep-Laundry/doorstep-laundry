import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isInTimeWindow } from "@/lib/slots";

/**
 * GET: Orders available to any driver.
 * Query: window=now|all (default all). "now" = only orders whose pickup/delivery date is today and current time is in the order's time slot.
 * Returns { pickups: Order[], deliveries: Order[] }.
 * - pickups: status scheduled (optionally filtered by pickup window).
 * - deliveries: ready_for_delivery with all loads ready + current run's out_for_delivery (run orders always included).
 * Each order includes scalars (e.g. numberOfLoads) plus orderLoads, customer, pickupAddress, deliveryAddress.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!isStaff(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const userId = (session.user as { id: string }).id;
  const { searchParams } = new URL(request.url);
  const windowParam = searchParams.get("window") ?? "all";
  const windowNow = windowParam === "now";

  const include = {
    customer: { select: { id: true, name: true, email: true, phone: true } },
    pickupAddress: true,
    deliveryAddress: true,
    orderLoads: {
      select: { id: true, loadNumber: true, status: true, location: true },
      orderBy: { loadNumber: "asc" as const },
    },
  } as const;

  const now = new Date();

  // Facility dropoffs: picked_up orders awaiting location assignment before wash
  const facilityOrders = await prisma.order.findMany({
    where: { status: "picked_up" },
    include,
    orderBy: { pickupDate: "asc" },
  });

  // Pickups: scheduled orders + out_for_pickup orders (driver en route)
  const scheduledOrders = await prisma.order.findMany({
    where: { status: { in: ["scheduled", "out_for_pickup"] } },
    include,
    orderBy: { pickupDate: "asc" },
  });
  const pickups = windowNow
    ? scheduledOrders.filter((o) =>
        o.status === "out_for_pickup" || isInTimeWindow(o.pickupDate, o.pickupTimeSlot, now)
      )
    : scheduledOrders;

  // Deliveries: ready_for_delivery (all loads ready) + current run's out_for_delivery
  const readyOrders = await prisma.order.findMany({
    where: { status: "ready_for_delivery" },
    include,
    orderBy: { deliveryDate: "asc" },
  });

  const runs = await prisma.driverRun.findMany({
    where: { driverId: userId },
    orderBy: { startedAt: "desc" },
    take: 5,
  });

  let runOrderIds: string[] = [];
  for (const run of runs) {
    const ids = run.orderIds as string[];
    const delivered = await prisma.order.count({
      where: { id: { in: ids }, status: "delivered" },
    });
    if (delivered < ids.length) {
      runOrderIds = ids;
      break;
    }
  }

  const runOrders =
    runOrderIds.length > 0
      ? await prisma.order.findMany({
          where: { id: { in: runOrderIds }, status: "out_for_delivery" },
          include,
        })
      : [];

  const readyWithAllLoads = readyOrders.filter((order) => {
    const loads = order.orderLoads ?? [];
    if (loads.length === 0) return false;
    return loads.every((l) => l.status === "ready_for_delivery");
  });

  const readyFiltered = windowNow
    ? readyWithAllLoads.filter((o) =>
        isInTimeWindow(o.deliveryDate, o.deliveryTimeSlot, now)
      )
    : readyWithAllLoads;

  const runIdSet = new Set(runOrderIds);
  const deliveriesOrdered = runOrderIds.length
    ? [
        ...runOrderIds.map((id) =>
          runOrders.find((o) => o.id === id)
        ).filter(Boolean),
        ...readyFiltered.filter((o) => !runIdSet.has(o.id)),
      ]
    : readyFiltered;

  return NextResponse.json({ pickups, facility: facilityOrders, deliveries: deliveriesOrdered });
}
