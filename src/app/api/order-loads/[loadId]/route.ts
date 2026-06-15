import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isStaff } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { LoadStatus } from "@prisma/client";
import { getOrderStatusFromLoads } from "@/lib/order-transitions";

const VALID_LOAD_STATUSES: LoadStatus[] = [
  "scheduled",
  "picked_up",
  "ready_for_wash",
  "washing",
  "drying",
  "folding",
  "cleaned",
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ loadId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (!isStaff(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { loadId } = await params;
  let body: { status?: string; location?: string; weightLbs?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const load = await prisma.orderLoad.findUnique({
    where: { id: loadId },
    include: { order: true },
  });
  if (!load) {
    return NextResponse.json({ error: "Load not found" }, { status: 404 });
  }

  const orderStatus = load.order.status as string;
  const orderPaid =
    orderStatus === "ready_for_delivery" ||
    orderStatus === "out_for_delivery" ||
    orderStatus === "delivered";
  if (orderPaid) {
    return NextResponse.json(
      { error: "Cannot change load once order is ready for delivery or later." },
      { status: 403 }
    );
  }

  const data: { status?: LoadStatus; location?: string | null; weightLbs?: number | null } = {};
  if (body.status != null) {
    const s = body.status as LoadStatus;
    if (!VALID_LOAD_STATUSES.includes(s)) {
      return NextResponse.json({ error: "Invalid load status" }, { status: 400 });
    }
    data.status = s;
  }
  if (body.location !== undefined) {
    data.location = body.location === "" || body.location == null ? null : String(body.location);
  }
  if (body.weightLbs !== undefined) {
    const w = typeof body.weightLbs === "number" && body.weightLbs >= 0 ? body.weightLbs : null;
    data.weightLbs = w;
    // Weighing a "cleaned" (folded) load means it's ready for delivery
    if (w != null && w > 0 && load.status === "cleaned" && data.status == null) {
      data.status = "ready_for_delivery";
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(load);
  }

  const updated = await prisma.orderLoad.update({
    where: { id: loadId },
    data,
    include: { order: true },
  });

  const orderId = load.orderId;
  const allLoads = await prisma.orderLoad.findMany({
    where: { orderId },
    select: { status: true, location: true, weightLbs: true },
  });
  const currentOrderStatus = updated.order.status as import("@/lib/order-transitions").OrderStatus;
  const newOrderStatus = getOrderStatusFromLoads(currentOrderStatus, allLoads);

  if (newOrderStatus) {
    const orderData: Parameters<typeof prisma.order.update>[0]["data"] = { status: newOrderStatus };
    if (newOrderStatus === "ready_for_delivery") {
      orderData.paymentStatus = "ready_for_payment";
    }
    await prisma.order.update({
      where: { id: orderId },
      data: orderData,
    });
    const note = getNoteForOrderStatusChange(newOrderStatus);
    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: newOrderStatus,
        note,
        changedById: (session.user as { id: string }).id,
      },
    });
  }

  return NextResponse.json(updated);
}

function getNoteForOrderStatusChange(status: string): string {
  const notes: Record<string, string> = {
    ready_for_delivery: "All loads weighed and ready for delivery",
    ready_for_wash: "All loads have shelf location",
    in_progress: "Wash started (load status updated)",
  };
  return notes[status] ?? "Order status updated";
}
