import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RawRow = {
  customer_type: string;
  revenue_cents: bigint;
  load_count: bigint;
};

export type CustomerTypeDataPoint = {
  customerType: string;
  revenueDollars: number;
  loadCount: number;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      u.customer_type,
      COALESCE(SUM(o.total_cents), 0)  AS revenue_cents,
      COALESCE(COUNT(ol.id),       0)  AS load_count
    FROM "User" u
    LEFT JOIN "Order" o  ON o.customer_id = u.id AND o.status != 'cancelled'
    LEFT JOIN "OrderLoad" ol ON ol.order_id = o.id
    WHERE u.role = 'customer'
    GROUP BY u.customer_type
  `;

  const data: CustomerTypeDataPoint[] = rows.map((r) => ({
    customerType: r.customer_type,
    revenueDollars: Number(r.revenue_cents) / 100,
    loadCount: Number(r.load_count),
  }));

  return NextResponse.json(data);
}
