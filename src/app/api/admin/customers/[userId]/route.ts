import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CustomerType } from "@prisma/client";

const CUSTOMER_TYPE_VALUES = new Set<string>(Object.values(CustomerType));

const CUSTOMER_SELECT = {
  id: true,
  email: true,
  name: true,
  customPricePerPoundCents: true,
  nmgrtExempt: true,
  customerType: true,
  creditedLoads: true,
} as const;

/** GET: Customer detail for admin (pricing, orders count). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...CUSTOMER_SELECT,
      phone: true,
      role: true,
      defaultLoadOptions: true,
      _count: { select: { orders: true } },
    },
  });
  if (!user) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  const { _count, ...rest } = user;
  return NextResponse.json({ ...rest, orderCount: _count.orders });
}

/** PATCH: Update customer settings (admin only). Body: customPricePerPoundCents?, nmgrtExempt?, customerType? */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  let body: {
    customPricePerPoundCents?: number | null;
    nmgrtExempt?: boolean;
    customerType?: string;
    creditedLoads?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: {
    customPricePerPoundCents?: number | null;
    nmgrtExempt?: boolean;
    customerType?: CustomerType;
    creditedLoads?: number;
  } = {};

  if (body.customPricePerPoundCents !== undefined) {
    if (body.customPricePerPoundCents === null) {
      data.customPricePerPoundCents = null;
    } else if (
      typeof body.customPricePerPoundCents === "number" &&
      body.customPricePerPoundCents >= 0
    ) {
      data.customPricePerPoundCents = Math.round(body.customPricePerPoundCents);
    }
  }
  if (typeof body.nmgrtExempt === "boolean") {
    data.nmgrtExempt = body.nmgrtExempt;
  }
  if (typeof body.customerType === "string" && CUSTOMER_TYPE_VALUES.has(body.customerType)) {
    data.customerType = body.customerType as CustomerType;
  }
  if (typeof body.creditedLoads === "number" && body.creditedLoads >= 0) {
    data.creditedLoads = Math.floor(body.creditedLoads);
  }

  if (Object.keys(data).length === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: CUSTOMER_SELECT,
    });
    return NextResponse.json(user ?? { error: "Not found" }, { status: user ? 200 : 404 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: CUSTOMER_SELECT,
  });
  return NextResponse.json(updated);
}
