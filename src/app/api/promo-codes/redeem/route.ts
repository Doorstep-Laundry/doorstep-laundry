import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** POST: Redeem a promo code. Body: { code: string } */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as { id: string }).id;

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.code !== "string" || !body.code.trim()) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const code = body.code.trim().toUpperCase();

  const promoCode = await prisma.promoCode.findUnique({
    where: { code },
    include: { redemptions: { where: { userId } } },
  });

  if (!promoCode) {
    return NextResponse.json({ error: "Invalid promo code" }, { status: 404 });
  }

  if (promoCode.redemptions.length > 0) {
    return NextResponse.json({ error: "You have already used this code" }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.promoCodeRedemption.create({
      data: { promoCodeId: promoCode.id, userId },
    });
    return tx.user.update({
      where: { id: userId },
      data: { creditedLoads: { increment: promoCode.numberOfLoads } },
      select: { creditedLoads: true },
    });
  });

  return NextResponse.json({
    creditedLoads: updated.creditedLoads,
    loadsAdded: promoCode.numberOfLoads,
  });
}
