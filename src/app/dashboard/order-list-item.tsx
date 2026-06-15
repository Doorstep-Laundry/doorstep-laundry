"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getTimeSlotById } from "@/lib/slots";
import { DeleteDraftOrderButton } from "@/components/delete-draft-order-button";
import { PayButton } from "@/app/orders/[orderId]/pay-button";
import { ReceiptDownloadButton } from "@/components/receipt-download-button";

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

export type OrderListItemOrder = {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus?: string | null;
  stripePaymentId?: string | null;
  totalCents?: number | null;
  pickupDate: Date | string;
  deliveryDate: Date | string;
  pickupTimeSlot: string | null;
  deliveryTimeSlot: string | null;
  orderLoads?: { weightLbs: number | null; creditedLoad?: boolean }[];
};

export function OrderListItem({
  order,
  creditedLoads = 0,
}: {
  order: OrderListItemOrder;
  creditedLoads?: number;
}) {
  const router = useRouter();
  const [applyingCredit, setApplyingCredit] = useState(false);
  const isScheduled = order.status === "scheduled";
  const showPay = order.paymentStatus === "ready_for_payment" && !order.stripePaymentId;
  const showReceipt = Boolean(order.stripePaymentId);
  const creditEligible = ["picked_up", "in_progress", "ready_for_delivery"].includes(order.status);
  const hasUncreditedLoads = order.orderLoads?.some((l) => !l.creditedLoad) ?? true;
  const showUseCredit = creditedLoads > 0 && creditEligible && hasUncreditedLoads;

  async function handleUseCredit() {
    setApplyingCredit(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/apply-credit`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        console.error("Failed to apply credit:", data.error);
      }
    } finally {
      setApplyingCredit(false);
    }
  }

  return (
    <li className="flex gap-2 items-stretch">
      <Link
        href={`/orders/${order.id}`}
        className="flex-1 min-w-0 block rounded-2xl border border-fern-200/80 bg-white p-5 hover:bg-fern-50/50 hover:border-fern-200 transition-colors shadow-sm"
      >
        <div className="flex justify-between items-start">
          <div>
            <span className="font-mono font-medium text-fern-900">
              {order.orderNumber}
            </span>
            <p className="text-sm text-fern-500 mt-1">
              Pickup {new Date(order.pickupDate).toLocaleDateString()}
              {order.pickupTimeSlot && ` ${getTimeSlotById(order.pickupTimeSlot)?.label ?? order.pickupTimeSlot}`}
              {" · Delivery "}
              {new Date(order.deliveryDate).toLocaleDateString()}
              {order.deliveryTimeSlot && ` ${getTimeSlotById(order.deliveryTimeSlot)?.label ?? order.deliveryTimeSlot}`}
            </p>
            {order.paymentStatus === "ready_for_payment" && (order.totalCents != null || (order.orderLoads?.length ?? 0) > 0) && (
              <p className="text-sm text-fern-700 mt-1">
                {order.totalCents != null && order.totalCents > 0 && (
                  <>Total: ${(Math.round(order.totalCents) / 100).toFixed(2)}</>
                )}
                {order.orderLoads?.length ? (
                  <span className="text-fern-600">
                    {order.totalCents != null && order.totalCents > 0 ? " · " : ""}
                    {order.orderLoads
                      .map((l) => (l.weightLbs != null ? `${l.weightLbs.toFixed(1)} lbs` : null))
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </span>
                ) : null}
              </p>
            )}
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
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
      </Link>
      {showPay && (
        <PayButton orderId={order.id} variant="icon" />
      )}
      {showReceipt && (
        <ReceiptDownloadButton orderId={order.id} variant="icon" />
      )}
      {showUseCredit && (
        <button
          type="button"
          onClick={handleUseCredit}
          disabled={applyingCredit}
          aria-label="Use a free load credit"
          title="Use a free load credit"
          className="shrink-0 self-stretch rounded-xl border border-green-300 bg-green-50 px-3 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a4 4 0 00-4-4H6m6 6a4 4 0 014-4h2m-6 0v0m0 13H7a2 2 0 01-2-2V9a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2h-5z" />
          </svg>
        </button>
      )}
      {isScheduled && (
        <DeleteDraftOrderButton
          orderId={order.id}
          variant="icon"
          onDeleted={() => router.refresh()}
        />
      )}
    </li>
  );
}
