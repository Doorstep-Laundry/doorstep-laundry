import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit O, I, 0, 1 for readability
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  code += "-";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** GET: List all promo codes with redemption counts (admin only). */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role: string }).role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  void request;
  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { redemptions: true } } },
  });
  return NextResponse.json(
    codes.map(({ _count, ...c }) => ({ ...c, redemptionCount: _count.redemptions }))
  );
}

/** POST: Generate promo codes (admin only). Body: { count: number, numberOfLoads: number } */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role: string }).role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { count?: unknown; numberOfLoads?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const count = typeof body.count === "number" ? Math.floor(body.count) : NaN;
  const numberOfLoads = typeof body.numberOfLoads === "number" ? Math.floor(body.numberOfLoads) : NaN;

  if (!count || count < 1 || count > 500)
    return NextResponse.json({ error: "count must be 1–500" }, { status: 400 });
  if (!numberOfLoads || numberOfLoads < 1)
    return NextResponse.json({ error: "numberOfLoads must be ≥ 1" }, { status: 400 });

  // Generate unique codes with collision retry
  const created = [];
  let attempts = 0;
  while (created.length < count && attempts < count * 5) {
    attempts++;
    const code = generateCode();
    try {
      const promo = await prisma.promoCode.create({
        data: { code, numberOfLoads },
      });
      created.push({ ...promo, redemptionCount: 0 });
    } catch {
      // unique constraint violation — retry with a new code
    }
  }

  if (created.length < count) {
    return NextResponse.json(
      { error: "Could not generate enough unique codes, try again" },
      { status: 500 }
    );
  }

  return NextResponse.json(created, { status: 201 });
}
