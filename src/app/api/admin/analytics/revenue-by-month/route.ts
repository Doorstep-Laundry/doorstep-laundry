import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RawRow = {
  year: number;
  month: number;
  revenue_cents: bigint;
};

export type RevenueByMonthPoint = {
  year: number;
  month: number; // 1–12
  revenueDollars: number;
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
      EXTRACT(YEAR  FROM pickup_date)::int AS year,
      EXTRACT(MONTH FROM pickup_date)::int AS month,
      COALESCE(SUM(total_cents), 0)        AS revenue_cents
    FROM "Order"
    WHERE status != 'cancelled'
    GROUP BY year, month
    ORDER BY year, month
  `;

  const data: RevenueByMonthPoint[] = rows.map((r) => ({
    year: r.year,
    month: r.month,
    revenueDollars: Number(r.revenue_cents) / 100,
  }));

  return NextResponse.json(data);
}
