import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

type RawRow = {
  day_of_week: number; // 0=Mon … 6=Sun
  is_am: boolean;
  load_count: number;
};

export type LoadsByDayPoint = {
  dayOfWeek: number; // 0=Mon … 6=Sun
  isAm: boolean;
  loadCount: number;
};

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if ((session.user as { role: string }).role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const dateCondition =
    from && to ? Prisma.sql`AND o.pickup_date >= ${new Date(from)} AND o.pickup_date <= ${new Date(to)}` :
    from       ? Prisma.sql`AND o.pickup_date >= ${new Date(from)}` :
    to         ? Prisma.sql`AND o.pickup_date <= ${new Date(to)}` :
                 Prisma.empty;

  // PostgreSQL DOW: 0=Sun … 6=Sat → remap to Mon=0 … Sun=6 via (dow+6)%7
  const rows = await prisma.$queryRaw<RawRow[]>(Prisma.sql`
    SELECT
      ((EXTRACT(DOW FROM o.pickup_date)::int + 6) % 7)  AS day_of_week,
      (o.pickup_time_slot IS DISTINCT FROM 'evening')    AS is_am,
      COUNT(ol.id)::int                                  AS load_count
    FROM "Order" o
    JOIN "OrderLoad" ol ON ol.order_id = o.id
    WHERE o.status != 'cancelled' ${dateCondition}
    GROUP BY day_of_week, is_am
    ORDER BY day_of_week
  `);

  const data: LoadsByDayPoint[] = rows.map((r) => ({
    dayOfWeek: Number(r.day_of_week),
    isAm:      Boolean(r.is_am),
    loadCount: Number(r.load_count),
  }));

  return NextResponse.json(data);
}
