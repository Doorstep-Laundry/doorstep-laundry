import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppHeader } from "@/components/app-header";
import { DashboardOrderList } from "./dashboard-order-list";
import { PromoCodeSection } from "./promo-code-section";
import type { OrderListItemOrder } from "./order-list-item";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;
  const role = (session.user as { role: string }).role;
  if (role === "staff" || role === "admin") redirect("/wash");

  const [orders, customer] = await Promise.all([
    prisma.order.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        orderLoads: { orderBy: { loadNumber: "asc" }, select: { weightLbs: true } },
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { creditedLoads: true } }),
  ]);

  const orderList = orders as OrderListItemOrder[];
  const creditedLoads = customer?.creditedLoads ?? 0;

  return (
    <div className="min-h-screen bg-fern-50">
      <AppHeader />
      <PromoCodeSection initialCreditedLoads={creditedLoads} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-xl font-semibold text-fern-900 mb-6">
          My orders
        </h1>
        {orderList.length === 0 ? (
          <div className="rounded-2xl border border-fern-200/80 bg-white p-10 text-center shadow-sm">
            <p className="text-fern-600">
              You don&apos;t have any orders yet.
            </p>
            <Link
              href="/book"
              className="mt-5 inline-block rounded-lg bg-fern-500 text-white px-5 py-2.5 text-sm font-medium hover:bg-fern-600 transition-colors"
            >
              Book a pickup
            </Link>
          </div>
        ) : (
          <DashboardOrderList orders={orderList} />
        )}
      </main>
    </div>
  );
}
