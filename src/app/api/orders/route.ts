import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateOrderNumber } from "@/lib/order-number";
import { sendOrderNotification, sendPastDueReminderEmail } from "@/lib/notify";
import { getPastDueOrders } from "@/lib/past-due";
import { toOrderLoadOptions, type LoadOptionsInput } from "@/lib/load-options";
import {
  normalizeBulkyItems,
  type BulkyItems,
} from "@/lib/bulky-items";
import type { OrderStatus } from "@prisma/client";
import { checkAddressWithinServiceArea } from "@/lib/service-area";
import {
  isWashVisibleOrderStatus,
  sortOrdersForWash,
  WASH_VISIBLE_ORDER_STATUSES,
} from "@/lib/wash-orders";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role: string }).role;

  const { searchParams } = new URL(request.url);
  const pickupDate = searchParams.get("pickupDate");
  const status = searchParams.get("status");

  if (role === "staff" || role === "admin") {
    const showDelivered = ["1", "true"].includes(searchParams.get("showDelivered") ?? "");
    const forWash = ["1", "true"].includes(searchParams.get("forWash") ?? "");
    const where: {
      pickupDate?: { gte: Date; lte: Date };
      status?: OrderStatus | { notIn: OrderStatus[] } | { in: OrderStatus[] };
      AND?: Array<
        | { status: OrderStatus }
        | { NOT: { status: OrderStatus } }
        | { status: { notIn: OrderStatus[] } }
      >;
    } = {};
    const filter = searchParams.get("filter");
    const useDueToday = filter === "due_today" || (pickupDate && filter !== "all");
    if (useDueToday || pickupDate) {
      const d = pickupDate ? new Date(pickupDate) : new Date();
      const start = new Date(d);
      start.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      where.pickupDate = { gte: start, lte: end };
    }
    if (forWash) {
      if (status && isWashVisibleOrderStatus(status)) {
        where.status = status;
      } else {
        where.status = { in: WASH_VISIBLE_ORDER_STATUSES };
      }
    } else if (status) {
      where.status = status as OrderStatus;
    } else {
      const excludedStatuses: OrderStatus[] = showDelivered ? ["cancelled"] : ["cancelled", "delivered"];
      where.status = { notIn: excludedStatuses };
    }
    let orders = await prisma.order.findMany({
      where,
      orderBy: { pickupDate: "asc" },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        pickupAddress: true,
        deliveryAddress: true,
        orderLoads: { orderBy: { loadNumber: "asc" } },
      },
    });
    if (forWash) {
      orders = sortOrdersForWash(orders);
    }
    const orderIdsNeedingLoads = orders
      .filter(
        (o) =>
          o.status !== "cancelled" &&
          o.orderLoads.length < o.numberOfLoads
      )
      .map((o) => ({ id: o.id, numberOfLoads: o.numberOfLoads }));
    for (const { id: orderId, numberOfLoads } of orderIdsNeedingLoads) {
      const order = orders.find((o) => o.id === orderId)!;
      const existing = order.orderLoads;
      const existingNumbers = new Set(existing.map((l) => l.loadNumber));
      for (let n = 1; n <= numberOfLoads; n++) {
        if (!existingNumbers.has(n)) {
          await prisma.orderLoad.create({
            data: {
              orderId,
              loadNumber: n,
              loadCode: `${order.orderNumber}-L${n}`,
              status: "scheduled",
            },
          });
        }
      }
    }
    if (orderIdsNeedingLoads.length > 0) {
      let refreshed = await prisma.order.findMany({
        where: { id: { in: orders.map((o) => o.id) } },
        orderBy: { pickupDate: "asc" },
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          pickupAddress: true,
          deliveryAddress: true,
          orderLoads: { orderBy: { loadNumber: "asc" } },
        },
      });
      if (forWash) {
        refreshed = sortOrdersForWash(refreshed);
      }
      return NextResponse.json(refreshed);
    }
    return NextResponse.json(orders);
  }

  const orders = await prisma.order.findMany({
    where: { customerId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      pickupAddress: true,
      deliveryAddress: true,
    },
  });
  return NextResponse.json(orders);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "customer" && role !== "staff" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const customerId = (session.user as { id: string }).id;
  if (role === "customer") {
    const [orders, pastDueOrders] = await Promise.all([
      prisma.order.findMany({ where: { customerId }, select: { id: true } }),
      getPastDueOrders(customerId),
    ]);
    if (orders.length >= 100) {
      return NextResponse.json(
        { error: "Order limit reached" },
        { status: 400 }
      );
    }
    if (pastDueOrders.length > 0) {
      sendPastDueReminderEmail(customerId, pastDueOrders).catch((e) =>
        console.error("[orders POST] sendPastDueReminderEmail:", e)
      );
      return NextResponse.json(
        {
          error: "You have an outstanding balance. Please pay your previous order before scheduling a new pickup.",
          pastDueOrderIds: pastDueOrders.map((o) => o.id),
        },
        { status: 402 }
      );
    }
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
      totalCents,
      loadOptions,
      bulkyItems: bulkyItemsPayload,
      premiumSurchargePerPoundCents: premiumSurchargeCents,
    } = body as {
      pickupAddressId?: string;
      deliveryAddressId?: string;
      pickupDate?: string;
      deliveryDate?: string;
      pickupTimeSlot?: string;
      deliveryTimeSlot?: string;
      notes?: string;
      numberOfLoads?: number;
      totalCents?: number;
      loadOptions?: LoadOptionsInput[];
      bulkyItems?: BulkyItems[];
      premiumSurchargePerPoundCents?: number;
    };
    const loads = numberOfLoads != null && numberOfLoads >= 1 ? numberOfLoads : 1;
    // Total computed after weigh-in (post-weigh payment); use 0 until then
    const computedTotalCents = totalCents != null && totalCents >= 0 ? totalCents : 0;
    const computedSurchargeCents =
      premiumSurchargeCents != null && Number.isFinite(premiumSurchargeCents) && premiumSurchargeCents >= 0
        ? Math.round(premiumSurchargeCents)
        : 0;
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

    const orderCustomerId = (body as { customerId?: string }).customerId;
    const effectiveCustomerId = role === "customer" ? customerId : orderCustomerId ?? customerId;
    if (!effectiveCustomerId) {
      return NextResponse.json({ error: "customerId required for staff" }, { status: 400 });
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

    const orderNumber = await generateOrderNumber();
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: effectiveCustomerId,
        pickupAddressId,
        deliveryAddressId,
        pickupDate: pickup,
        deliveryDate: delivery,
        pickupTimeSlot: pickupTimeSlot ?? null,
        deliveryTimeSlot: deliveryTimeSlot ?? null,
        notes: notes ?? null,
        numberOfLoads: loads,
        totalCents: computedTotalCents,
        premiumSurchargePerPoundCents: computedSurchargeCents,
        status: "scheduled",
      },
      include: {
        pickupAddress: true,
        deliveryAddress: true,
      },
    });

    for (let n = 1; n <= loads; n++) {
      const opts = toOrderLoadOptions(loadOptions?.[n - 1]);
      const bulkyNorm = normalizeBulkyItems(bulkyItemsPayload?.[n - 1]);
      await prisma.orderLoad.create({
        data: {
          orderId: order.id,
          loadNumber: n,
          loadCode: `${order.orderNumber}-L${n}`,
          status: "scheduled",
          ...opts,
          bulkyItems:
            Object.keys(bulkyNorm).length > 0
              ? (bulkyNorm as object)
              : undefined,
        },
      });
    }

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: "scheduled",
        note: "Order created",
        changedById: (session.user as { id: string }).id,
      },
    });
    await sendOrderNotification(order.id, "order_created").catch((e) =>
      console.error("Notify order_created:", e)
    );
    return NextResponse.json(order);
  } catch (e) {
    console.error("Create order error:", e);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
