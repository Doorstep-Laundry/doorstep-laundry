import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sortOrdersForWash, WASH_VISIBLE_ORDER_STATUSES } from "@/lib/wash-orders";
import { AppHeader } from "@/components/app-header";
import { WashDashboard } from "./wash-dashboard";

export default async function WashPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const role = (session.user as { role: string }).role;
  if (role !== "staff" && role !== "admin") redirect("/dashboard");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  let orders = await prisma.order.findMany({
    where: {
      status: { in: WASH_VISIBLE_ORDER_STATUSES },
      pickupDate: { gte: today, lte: endOfToday },
    },
    orderBy: { pickupDate: "asc" },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      pickupAddress: true,
      deliveryAddress: true,
      orderLoads: { orderBy: { loadNumber: "asc" } },
    },
  });

  for (const order of orders) {
    if (order.orderLoads.length < order.numberOfLoads) {
      const existingNumbers = new Set(order.orderLoads.map((l) => l.loadNumber));
      for (let n = 1; n <= order.numberOfLoads; n++) {
        if (!existingNumbers.has(n)) {
          await prisma.orderLoad.create({
            data: {
              orderId: order.id,
              loadNumber: n,
              loadCode: `${order.orderNumber}-L${n}`,
              status: "scheduled",
            },
          });
        }
      }
    }
  }
  orders = await prisma.order.findMany({
    where: {
      status: { in: WASH_VISIBLE_ORDER_STATUSES },
      pickupDate: { gte: today, lte: endOfToday },
    },
    orderBy: { pickupDate: "asc" },
    include: {
      customer: { select: { id: true, name: true, email: true, phone: true } },
      pickupAddress: true,
      deliveryAddress: true,
      orderLoads: { orderBy: { loadNumber: "asc" } },
    },
  });

  orders = sortOrdersForWash(orders);

  return (
    <div className="min-h-screen bg-fern-50">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-xl font-semibold text-fern-900 mb-6">
          Wash – Orders
        </h1>
        <WashDashboard initialOrders={orders} initialFilter="due_today" />
      </main>
    </div>
  );
}
