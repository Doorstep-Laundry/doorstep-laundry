import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { LoadStatus } from "@prisma/client";
import {
  canAddOrderLoad,
  canDeleteLastOrderLoad,
  initialLoadStatusForOrder,
} from "@/lib/order-loads-policy";
import { normalizeBulkyItems, type BulkyItems } from "@/lib/bulky-items";

/**
 * POST: Add one load to an order (driver at pickup or washer splitting a load).
 * Increments numberOfLoads and creates OrderLoad with next loadNumber.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!isStaff(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await params;
  const userId = (session.user as { id: string }).id;

  let bulkyForNewLoad: BulkyItems | undefined;
  try {
    const body = (await request.json()) as { bulkyItems?: BulkyItems };
    if (body?.bulkyItems && typeof body.bulkyItems === "object") {
      const norm = normalizeBulkyItems(body.bulkyItems);
      if (Object.keys(norm).length > 0) bulkyForNewLoad = norm;
    }
  } catch {
    /* empty or invalid body */
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderLoads: { orderBy: { loadNumber: "asc" } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (!canAddOrderLoad(order.status)) {
    return NextResponse.json(
      { error: "Cannot add loads to this order in its current status" },
      { status: 400 }
    );
  }

  const loads = order.orderLoads ?? [];
  const existingNumbers = new Set(loads.map((l) => l.loadNumber));
  const status = initialLoadStatusForOrder(order.status);

  await prisma.$transaction(async (tx) => {
    // Fill gaps up to current numberOfLoads so load numbers stay contiguous before adding.
    for (let n = 1; n <= order.numberOfLoads; n++) {
      if (!existingNumbers.has(n)) {
        await tx.orderLoad.create({
          data: {
            orderId,
            loadNumber: n,
            loadCode: `${order.orderNumber}-L${n}`,
            status,
          },
        });
        existingNumbers.add(n);
      }
    }

    const maxLoadNumber = Math.max(0, ...Array.from(existingNumbers));
    const nextLoadNumber = maxLoadNumber + 1;

    await tx.orderLoad.create({
      data: {
        orderId,
        loadNumber: nextLoadNumber,
        loadCode: `${order.orderNumber}-L${nextLoadNumber}`,
        status,
        bulkyItems:
          bulkyForNewLoad && Object.keys(bulkyForNewLoad).length > 0
            ? (bulkyForNewLoad as object)
            : undefined,
      },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { numberOfLoads: { increment: 1 } },
    });
  });

  const finalOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      pickupAddress: true,
      deliveryAddress: true,
      orderLoads: { orderBy: { loadNumber: "asc" } },
    },
  });

  if (!finalOrder) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json(finalOrder);
}

/**
 * DELETE: Remove the highest-numbered load (driver only use case; no UI for washers).
 * Allowed only when order is scheduled or picked_up and the last load is still pre-wash.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!isStaff(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { orderId } = await params;
  const userId = (session.user as { id: string }).id;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderLoads: { orderBy: { loadNumber: "desc" } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const loads = order.orderLoads ?? [];
  if (loads.length === 0) {
    return NextResponse.json({ error: "No loads to remove" }, { status: 400 });
  }

  const lastLoad = loads[0];
  const deleteCheck = canDeleteLastOrderLoad(
    order.status,
    order.numberOfLoads,
    lastLoad.status as LoadStatus
  );
  if (!deleteCheck.ok) {
    return NextResponse.json({ error: deleteCheck.reason }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.orderLoad.delete({ where: { id: lastLoad.id } }),
    prisma.order.update({
      where: { id: orderId },
      data: { numberOfLoads: { decrement: 1 } },
    }),
  ]);

  await prisma.orderStatusHistory.create({
    data: {
      orderId,
      status: order.status,
      note: `Load ${lastLoad.loadNumber} removed (${lastLoad.loadCode ?? "no code"})`,
      changedById: userId,
    },
  });

  const finalOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      pickupAddress: true,
      deliveryAddress: true,
      orderLoads: { orderBy: { loadNumber: "asc" } },
    },
  });

  return NextResponse.json(finalOrder);
}
