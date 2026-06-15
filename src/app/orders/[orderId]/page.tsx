import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getTimeSlotById } from "@/lib/slots";
import { getEnabledLoadOptionLabels } from "@/lib/load-options";
import { AppHeader } from "@/components/app-header";
import { CreditedLoadsBanner } from "@/components/credited-loads-banner";
import { DeleteDraftOrderButton } from "@/components/delete-draft-order-button";
import { PayButton } from "./pay-button";
import { ResendPaymentButton } from "./resend-payment-button";
import { ReceiptDownloadButton } from "@/components/receipt-download-button";
import { OrderPricingAdmin } from "./order-pricing-admin";
import { UseCreditButton } from "./use-credit-button";

const statusLabel: Record<string, string> = {
  scheduled: "Scheduled",
  picked_up: "Picked up",
  ready_for_wash: "Ready for wash",
  in_progress: "In progress",
  ready_for_delivery: "Ready for delivery",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const userId = (session.user as { id: string }).id;
  const { orderId } = await params;

  const [order, customer] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      include: {
        pickupAddress: true,
        deliveryAddress: true,
        orderLoads: { orderBy: { loadNumber: "asc" } },
        customer: { select: { customPricePerPoundCents: true, nmgrtExempt: true } },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          include: { changedBy: { select: { name: true, email: true } } },
        },
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { creditedLoads: true, role: true } }),
  ]);
  if (!order) notFound();
  const role = (session.user as { role?: string }).role;
  const canView = order.customerId === userId || role === "staff" || role === "admin";
  if (!canView) redirect("/dashboard");
  const creditedLoads = role === "customer" ? (customer?.creditedLoads ?? 0) : 0;

  const creditedLoadCount = order.orderLoads?.filter((l) => l.creditedLoad).length ?? 0;

  let displayTotalCents = order.totalCents;
  if (order.paymentStatus === "ready_for_payment" && order.orderLoads?.length) {
    const { getEffectivePricing, computeOrderTotalWithTax } = await import("@/lib/order-total");
    const { getGrtPercent } = await import("@/lib/settings");
    const [setting, grtPercent] = await Promise.all([
      prisma.setting.findUnique({ where: { key: "price_per_pound_cents" } }),
      getGrtPercent(),
    ]);
    const defaultPriceCents = setting ? parseInt(String(setting.value), 10) || 150 : 150;
    const { pricePerPoundCents, nmgrtExempt } = getEffectivePricing(
      order,
      order.customer,
      defaultPriceCents
    );
    const billableLoads = order.orderLoads.filter((l) => !l.creditedLoad);
    const { totalCents } = computeOrderTotalWithTax(
      billableLoads.length > 0 ? billableLoads : order.orderLoads,
      pricePerPoundCents,
      grtPercent,
      nmgrtExempt
    );
    displayTotalCents = billableLoads.length > 0 ? totalCents : 0;
  }

  return (
    <div className="min-h-screen bg-fern-50">
      <AppHeader />
      <CreditedLoadsBanner creditedLoads={creditedLoads} />
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-fern-900 font-mono">
            {order.orderNumber}
          </h1>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-fern-600 hover:text-fern-900 transition-colors"
          >
            Back
          </Link>
        </div>
        <div className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <span className="text-fern-500">Status</span>
            <div className="flex items-center gap-2 flex-wrap">
              {role === "customer" &&
                creditedLoads > 0 &&
                ["picked_up", "in_progress", "ready_for_delivery"].includes(order.status) &&
                order.orderLoads?.some((l) => !l.creditedLoad) && (
                  <UseCreditButton orderId={order.id} />
              )}
              {order.paymentStatus === "ready_for_payment" && !order.stripePaymentId && (
                <>
                  <PayButton orderId={order.id} variant="icon" />
                  <ResendPaymentButton orderId={order.id} />
                </>
              )}
              {order.stripePaymentId && (
                <ReceiptDownloadButton orderId={order.id} />
              )}
              {order.status === "scheduled" && (
                <Link
                  href={`/orders/${order.id}/edit`}
                  className="rounded-lg border border-fern-200 bg-white p-2 text-fern-700 hover:bg-fern-50 transition-colors inline-flex items-center justify-center"
                  aria-label="Edit order"
                  title="Edit order"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </Link>
              )}
              {order.status === "scheduled" && (
                <DeleteDraftOrderButton orderId={order.id} variant="icon" />
              )}
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  order.status === "delivered"
                    ? "bg-fern-100 text-fern-700"
                    : order.status === "cancelled"
                      ? "bg-fern-100 text-fern-500"
                      : "bg-fern-200 text-fern-800"
                }`}
              >
                {statusLabel[order.status] ?? order.status}
              </span>
            </div>
          </div>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-fern-500">Pickup</dt>
              <dd className="text-fern-900 mt-0.5">
                {new Date(order.pickupDate).toLocaleDateString()}
                {order.pickupTimeSlot && (
                  <span className="text-fern-600">
                    {" "}({getTimeSlotById(order.pickupTimeSlot)?.label ?? order.pickupTimeSlot})
                  </span>
                )}
                {" – "}
                {order.pickupAddress.street}, {order.pickupAddress.city},{" "}
                {order.pickupAddress.state} {order.pickupAddress.zip}
              </dd>
            </div>
            <div>
              <dt className="text-fern-500">Delivery</dt>
              <dd className="text-fern-900 mt-0.5">
                {new Date(order.deliveryDate).toLocaleDateString()}
                {order.deliveryTimeSlot && (
                  <span className="text-fern-600">
                    {" "}({getTimeSlotById(order.deliveryTimeSlot)?.label ?? order.deliveryTimeSlot})
                  </span>
                )}
                {" – "}
                {order.deliveryAddress.street}, {order.deliveryAddress.city},{" "}
                {order.deliveryAddress.state} {order.deliveryAddress.zip}
              </dd>
            </div>
            {order.notes && (
              <div>
                <dt className="text-fern-500">Notes</dt>
                <dd className="text-fern-900 mt-0.5">{order.notes}</dd>
              </div>
            )}
            <div>
              <dt className="text-fern-500">Loads</dt>
              <dd className="text-fern-900 mt-0.5 font-medium">{(order as { numberOfLoads?: number }).numberOfLoads ?? 1}</dd>
            </div>
            {order.orderLoads && order.orderLoads.length > 0 && (
              <div>
                <dt className="text-fern-500">Load details</dt>
                <dd className="text-fern-900 mt-0.5">
                  <ul className="list-disc list-inside space-y-1">
                    {order.orderLoads.map((load: {
                      loadNumber: number;
                      weightLbs?: number | null;
                      creditedLoad?: boolean;
                      hotWater?: boolean;
                      bleach?: boolean;
                      hypoallergenic?: boolean;
                      delicateCycle?: boolean;
                      scentFree?: boolean;
                      coldWaterOnly?: boolean;
                    }) => {
                      const opts = getEnabledLoadOptionLabels(load);
                      return (
                        <li key={load.loadNumber} className="flex items-center gap-2">
                          <span>
                            Load {load.loadNumber}
                            {order.paymentStatus === "ready_for_payment" && (
                              <>: {(load.weightLbs ?? 0).toFixed(1)} lbs</>
                            )}
                            {opts.length > 0 && (
                              <span className="text-fern-600">
                                {" "}({opts.join(", ")})
                              </span>
                            )}
                          </span>
                          {load.creditedLoad && (
                            <span className="rounded-full bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5">
                              Free
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </dd>
              </div>
            )}
            {order.paymentStatus === "ready_for_payment" && order.orderLoads && order.orderLoads.length > 0 && (
              <div>
                <dt className="text-fern-500">Transaction number</dt>
                <dd className="text-fern-900 mt-0.5 font-mono">{order.orderNumber}</dd>
              </div>
            )}
            {creditedLoadCount > 0 && (
              <div>
                <dt className="text-fern-500">Load credits applied</dt>
                <dd className="text-green-700 mt-0.5 font-medium">
                  {creditedLoadCount} free {creditedLoadCount === 1 ? "load" : "loads"}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-fern-500">Total</dt>
              <dd className="text-fern-900 mt-0.5 font-medium">${(Math.round(displayTotalCents) / 100).toFixed(2)}</dd>
            </div>
          </dl>
        </div>

        {role === "admin" && order.status !== "cancelled" && (
          <div className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-medium text-fern-900 mb-3">
              Order pricing override (admin)
            </h2>
            <OrderPricingAdmin
              orderId={order.id}
              orderPricePerPoundCents={order.orderPricePerPoundCents}
              nmgrtExempt={order.nmgrtExempt}
            />
          </div>
        )}

        {order.statusHistory.length > 0 && (
          <div className="rounded-2xl border border-fern-200/80 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-medium text-fern-900 mb-4">
              Status history
            </h2>
            <ul className="space-y-3">
              {order.statusHistory.map((h: { id: string; status: string; note: string | null; createdAt: Date; changedBy: { name: string | null; email: string } | null }) => (
                <li key={h.id} className="flex flex-wrap gap-x-2 gap-y-0 text-sm items-baseline">
                  <span className="text-fern-500 shrink-0">
                    {new Date(h.createdAt).toLocaleString()}
                  </span>
                  <span className="font-medium text-fern-800">
                    {statusLabel[h.status] ?? h.status}
                  </span>
                  {h.note && (
                    <span className="text-fern-600">
                      – {h.note}
                    </span>
                  )}
                  {h.changedBy && (
                    <span className="text-fern-500">
                      by {h.changedBy.name ?? h.changedBy.email}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
