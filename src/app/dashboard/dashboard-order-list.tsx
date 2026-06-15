"use client";

import { useState, useMemo } from "react";
import { OrderListItem, type OrderListItemOrder } from "./order-list-item";

const STATUS_ORDER = [
  "scheduled",
  "picked_up",
  "ready_for_wash",
  "in_progress",
  "ready_for_delivery",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

function sortOrdersByStatus(orders: OrderListItemOrder[]): OrderListItemOrder[] {
  const orderRank = Object.fromEntries(
    STATUS_ORDER.map((s, i) => [s, i])
  );
  return [...orders].sort((a, b) => {
    const ra = orderRank[a.status] ?? 99;
    const rb = orderRank[b.status] ?? 99;
    if (ra !== rb) return ra - rb;
    return new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime();
  });
}

export function DashboardOrderList({
  orders,
  creditedLoads = 0,
}: {
  orders: OrderListItemOrder[];
  creditedLoads?: number;
}) {
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => sortOrdersByStatus(orders), [orders]);
  const displayed = showAll
    ? sorted
    : sorted.filter((o) => o.status !== "delivered");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            showAll
              ? "border-fern-500 bg-fern-50 text-fern-800"
              : "border-fern-200 bg-white text-fern-600 hover:bg-fern-50 hover:border-fern-300"
          }`}
        >
          {showAll ? "Showing all orders" : "Show all orders"}
        </button>
        {!showAll && (
          <span className="text-sm text-fern-500">
            Delivered orders are hidden
          </span>
        )}
      </div>
      {displayed.length === 0 ? (
        <div className="rounded-2xl border border-fern-200/80 bg-white p-10 text-center shadow-sm">
          <p className="text-fern-600">
            {showAll
              ? "You don't have any orders yet."
              : "No active orders. Turn on “Show all orders” to see delivered."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {displayed.map((order) => (
            <OrderListItem key={order.id} order={order} creditedLoads={creditedLoads} />
          ))}
        </ul>
      )}
    </div>
  );
}
