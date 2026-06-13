import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toOrderLoadOptions } from "@/lib/load-options";
import { checkAddressWithinServiceArea } from "@/lib/service-area";
import type { LoadOptionsInput } from "@/lib/load-options";
import {
  normalizeBulkyItems,
  type BulkyItems,
} from "@/lib/bulky-items";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { orderId } = await params;
  const role = (session.user as { role: string }).role;
  const userId = (session.user as { id: string }).id;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: role !== "customer" ? { select: { id: true, name: true, email: true, phone: true } } : false,
      pickupAddress: true,
      deliveryAddress: true,
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: { changedBy: { select: { name: true, email: true } } },
      },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (role === "customer" && order.customerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(order);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role: string }).role;
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderLoads: { orderBy: { loadNumber: "asc" } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (role === "customer" && order.customerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "scheduled") {
    return NextResponse.json(
      { error: "Only scheduled orders can be updated" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const {
      pickupAddressId,
      deliveryAddressId,
      pickupDate,
      deliveryDate,
      pickupTimeSlot,
      deliveryTimeSlot,
      notes,
      numberOfLoads,
      loadOptions,
      bulkyItems: bulkyItemsPayload,
    } = body as {
      pickupAddressId?: string;
      deliveryAddressId?: string;
      pickupDate?: string;
      deliveryDate?: string;
      pickupTimeSlot?: string;
      deliveryTimeSlot?: string;
      notes?: string;
      numberOfLoads?: number;
      loadOptions?: LoadOptionsInput[];
      bulkyItems?: BulkyItems[];
    };
    const loads = numberOfLoads != null && numberOfLoads >= 1 ? numberOfLoads : order.numberOfLoads;
    // totalCents set at weigh-in (waiting_for_payment); leave existing until then
    const totalCents = order.totalCents;

    if (
      !pickupAddressId ||
      !deliveryAddressId ||
      !pickupDate ||
      !deliveryDate
    ) {
      return NextResponse.json(
        { error: "pickupAddressId, deliveryAddressId, pickupDate, deliveryDate required" },
        { status: 400 }
      );
    }

    const pickup = new Date(pickupDate);
    const delivery = new Date(deliveryDate);
    if (isNaN(pickup.getTime()) || isNaN(delivery.getTime())) {
      return NextResponse.json({ error: "Invalid dates" }, { status: 400 });
    }

    const [pickupAddr, deliveryAddr] = await Promise.all([
      prisma.address.findUnique({ where: { id: pickupAddressId } }),
      prisma.address.findUnique({ where: { id: deliveryAddressId } }),
    ]);
    if (!pickupAddr || !deliveryAddr) {
      return NextResponse.json(
        { error: "Pickup or delivery address not found" },
        { status: 400 }
      );
    }
    for (const addr of [pickupAddr, deliveryAddr]) {
      const area = await checkAddressWithinServiceArea({
        street: addr.street,
        city: addr.city,
        state: addr.state,
        zip: addr.zip,
      });
      if (!area.ok) {
        return NextResponse.json({ error: area.error }, { status: 400 });
      }
    }

    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        pickupAddressId,
        deliveryAddressId,
        pickupDate: pickup,
        deliveryDate: delivery,
        pickupTimeSlot: pickupTimeSlot ?? null,
        deliveryTimeSlot: deliveryTimeSlot ?? null,
        notes: notes ?? null,
        numberOfLoads: loads,
        totalCents,
      },
    });

    const existingByNumber = new Map(order.orderLoads.map((l) => [l.loadNumber, l]));
    for (let n = 1; n <= loads; n++) {
      const opts = toOrderLoadOptions(loadOptions?.[n - 1]);
      const bulkyNorm = normalizeBulkyItems(bulkyItemsPayload?.[n - 1]);
      const bulkyJson =
        Object.keys(bulkyNorm).length > 0 ? (bulkyNorm as object) : null;
      const existing = existingByNumber.get(n);
      if (existing) {
        const data: Prisma.OrderLoadUpdateInput = { ...opts };
        if (bulkyItemsPayload !== undefined) {
          data.bulkyItems =
            bulkyJson === null
              ? Prisma.JsonNull
              : (bulkyJson as Prisma.InputJsonValue);
        }
        await prisma.orderLoad.update({
          where: { id: existing.id },
          data,
        });
      } else {
        await prisma.orderLoad.create({
          data: {
            orderId: orderId,
            loadNumber: n,
            loadCode: `${order.orderNumber}-L${n}`,
            status: "ready_for_pickup",
            ...opts,
            bulkyItems: bulkyJson ?? undefined,
          },
        });
      }
    }

    const withLoads = await prisma.order.findUnique({
      where: { id: orderId },
      include: { orderLoads: { orderBy: { loadNumber: "asc" } } },
    });
    return NextResponse.json(withLoads ?? updated);
  } catch (e) {
    console.error("Update order error:", e);
    return NextResponse.json(
      { error: "Failed to update order" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role: string }).role;
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { orderLoads: { where: { creditedLoad: true }, select: { id: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (role === "customer" && order.customerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== "scheduled") {
    return NextResponse.json(
      { error: "Only scheduled orders can be deleted" },
      { status: 400 }
    );
  }

  try {
    // Return any consumed credits before deleting
    const creditedCount = order.orderLoads.length;
    if (creditedCount > 0) {
      await prisma.user.update({
        where: { id: order.customerId },
        data: { creditedLoads: { increment: creditedCount } },
      });
    }
    await prisma.order.delete({ where: { id: orderId } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    console.error("Delete order error:", e);
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 }
    );
  }
}
