import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET: Search customers by email or name (admin only). Query param q= search string; returns up to 20. */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = (session.user as { role: string }).role;
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 1) {
    return NextResponse.json([]);
  }

  const customers = await prisma.user.findMany({
    where: {
      role: "customer",
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: { email: "asc" },
    take: 20,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      customPricePerPoundCents: true,
      nmgrtExempt: true,
      customerType: true,
    },
  });
  return NextResponse.json(customers);
}
