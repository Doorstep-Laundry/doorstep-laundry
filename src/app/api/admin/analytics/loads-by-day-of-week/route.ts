import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

type RawRow = {
  day_of_week: number; // 0=Mon … 6=Sun (remapped from PG DOW)
  year: number;
  week_number: number;
  is_am: boolean;
  load_count: number;
};

export type LoadsByDayPoint = {
  dayOfWeek: number; // 0=Mon … 6=Sun
  year: number;
  weekNumber: number;
  isAm: boolean;
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

  // PostgreSQL DOW: 0=Sun … 6=Sat → remap to Mon=0 … Sun=6 via (dow+6)%7
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      ((EXTRACT(DOW FROM o.pickup_date)::int + 6) % 7)   AS day_of_week,
      EXTRACT(YEAR  FROM o.pickup_date)::int              AS year,
      EXTRACT(WEEK  FROM o.pickup_date)::int              AS week_number,
      (o.pickup_time_slot IS DISTINCT FROM 'evening')     AS is_am,
      COUNT(ol.id)::int                                   AS load_count
    FROM "Order" o
    JOIN "OrderLoad" ol ON ol.order_id = o.id
    WHERE o.status != 'cancelled'
    GROUP BY day_of_week, year, week_number, is_am
    ORDER BY year, week_number, day_of_week
  `;

  const data: LoadsByDayPoint[] = rows.map((r) => ({
    dayOfWeek:  Number(r.day_of_week),
    year:       Number(r.year),
    weekNumber: Number(r.week_number),
    isAm:       Boolean(r.is_am),
    loadCount:  Number(r.load_count),
  }));

  return NextResponse.json(data);
}
