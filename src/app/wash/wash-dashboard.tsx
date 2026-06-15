"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getTimeSlotById } from "@/lib/slots";
import { getEnabledLoadOptionLabels } from "@/lib/load-options";
import { LoadTagPrintButton } from "@/components/load-tag-print";
import { WASH_VISIBLE_ORDER_STATUSES } from "@/lib/wash-orders";

const POLL_INTERVAL_MS = 15_000;

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  picked_up: "Picked up",
  ready_for_wash: "Ready for wash",
  in_progress: "In progress",
  ready_for_delivery: "Ready for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const LOAD_STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  picked_up: "Picked up",
  ready_for_wash: "Ready for wash",
  washing: "Washing",
  drying: "Drying",
  folded: "Folded",
  cleaned: "Folded (awaiting weigh-in)",
  ready_for_delivery: "Ready for delivery",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

type OrderLoadRow = {
  id: string;
  loadNumber: number;
  loadCode: string | null;
  status: string;
  location: string | null;
  weightLbs?: number | null;
  hotWater?: boolean;
  bleach?: boolean;
  hypoallergenic?: boolean;
  delicateCycle?: boolean;
  scentFree?: boolean;
  coldWaterOnly?: boolean;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  numberOfLoads: number;
  pickupDate: Date | string;
  deliveryDate: Date | string;
  pickupTimeSlot: string | null;
  deliveryTimeSlot: string | null;
  customer: { name: string | null; email: string; phone: string | null };
  pickupAddress: { street: string; city: string; state: string; zip: string };
  deliveryAddress: { street: string; city: string; state: string; zip: string };
  orderLoads: OrderLoadRow[];
};

export function WashDashboard({
  initialOrders,
  initialFilter = "due_today",
}: {
  initialOrders: OrderRow[];
  initialFilter?: "due_today" | "all";
}) {
  const [filter, setFilter] = useState<"due_today" | "all">(initialFilter);
  const [statusFilter, setStatusFilter] = useState("");
  const [orders, setOrders] = useState(initialOrders);
  const [loading, setLoading] = useState(false);
  const [updatingLoadId, setUpdatingLoadId] = useState<string | null>(null);
  const [weightDraft, setWeightDraft] = useState<Record<string, string>>({});
  const [loadLocationNames, setLoadLocationNames] = useState<string[]>([]);
  const [addingLoadOrderId, setAddingLoadOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/load-locations")
      .then((res) => res.json())
      .then((data) => {
        const names = Array.isArray(data)
          ? data.map((loc: { name: string }) => loc.name)
          : [];
        setLoadLocationNames(names);
      })
      .catch(() => {});
  }, []);

  const fetchOrders = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const params = new URLSearchParams();
    params.set("filter", filter);
    params.set("forWash", "1");
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/orders?${params}`);
    const data = await res.json().catch(() => []);
    setOrders(Array.isArray(data) ? data : []);
    if (showLoading) setLoading(false);
  }, [filter, statusFilter]);

  // Poll for updates from other washers; refetch when tab becomes visible
  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisible = () => {
      fetchOrders(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchOrders(false);
      }
    }, POLL_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [fetchOrders]);

  function setFilterAndFetch(value: "due_today" | "all") {
    setFilter(value);
    setLoading(true);
    const params = new URLSearchParams();
    params.set("filter", value);
    params.set("forWash", "1");
    if (statusFilter) params.set("status", statusFilter);
    fetch(`/api/orders?${params}`)
      .then((res) => res.json().catch(() => []))
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  async function addLoadToOrder(orderId: string) {
    setAddingLoadOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/loads`, { method: "POST" });
      const err = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof err.error === "string" ? err.error : "Failed to add load");
        return;
      }
      await fetchOrders(false);
    } finally {
      setAddingLoadOrderId(null);
    }
  }

  async function updateLoad(
    loadId: string,
    updates: { status?: string; location?: string; weightLbs?: number }
  ) {
    setUpdatingLoadId(loadId);
    try {
      const res = await fetch(`/api/order-loads/${loadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to update load");
        return;
      }
      const updated = await res.json();
      setOrders((prev) =>
        prev.map((o) => ({
          ...o,
          orderLoads: o.orderLoads.map((l) =>
            l.id === loadId
              ? {
                  ...l,
                  status: updated.status ?? l.status,
                  location: updated.location !== undefined ? updated.location : l.location,
                  loadCode: updated.loadCode !== undefined ? updated.loadCode : l.loadCode,
                  weightLbs: updated.weightLbs !== undefined ? updated.weightLbs : l.weightLbs,
                }
              : l
          ),
        }))
      );
      setWeightDraft((prev) => {
        const next = { ...prev };
        delete next[loadId];
        return next;
      });
      fetchOrders(false);
    } finally {
      setUpdatingLoadId(null);
    }
  }

  const inputClass =
    "rounded-lg border border-fern-200 bg-white px-2 py-1.5 text-sm text-fern-900 focus:border-fern-500 focus:outline-none focus:ring-2 focus:ring-fern-500/20";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4 items-center rounded-2xl border border-fern-200/80 bg-white p-4 shadow-sm">
        <div className="flex rounded-lg border border-fern-200 p-0.5 bg-fern-50">
          <button
            type="button"
            onClick={() => setFilterAndFetch("due_today")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filter === "due_today"
                ? "bg-white text-fern-900 shadow-sm"
                : "text-fern-600 hover:text-fern-900"
            }`}
          >
            Due today
          </button>
          <button
            type="button"
            onClick={() => setFilterAndFetch("all")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              filter === "all"
                ? "bg-white text-fern-900 shadow-sm"
                : "text-fern-600 hover:text-fern-900"
            }`}
          >
            All orders
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium text-fern-700 mb-1">
            Order status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={inputClass}
          >
            <option value="">All</option>
            {WASH_VISIBLE_ORDER_STATUSES.map((v) => (
              <option key={v} value={v}>
                {STATUS_LABEL[v] ?? v}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => fetchOrders(true)}
          disabled={loading}
          className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600 disabled:opacity-50 transition-colors"
        >
          {loading ? "Loading…" : "Apply"}
        </button>
        <span className="text-xs text-fern-500">
          Updates from other washers refresh every 15s and when you return to this tab.
        </span>
      </div>

      <p className="text-sm text-fern-600">
        Each load has a unique ID. Loads in the same order are grouped for pickup and delivery.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-fern-200/80 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-fern-200">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-fern-500">
                Order
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-fern-500">
                Order status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-fern-500">
                Load
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-fern-500">
                Load status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-fern-500">
                Location
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-fern-500">
                Weight (lbs)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-fern-500">
                DUE
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fern-200">
            {(() => {
              const rows = orders.flatMap(
                (order): { order: OrderRow; load: OrderLoadRow | null }[] => {
                  const loads = order.orderLoads ?? [];
                  if (loads.length === 0) {
                    return [{ order, load: null }];
                  }
                  return loads.map((load) => ({ order, load }));
                }
              );
              if (rows.length === 0) {
                return (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-fern-500">
                      No orders for this filter.
                    </td>
                  </tr>
                );
              }
              return rows.map(({ order, load }) => (
                <tr
                  key={load ? load.id : `${order.id}-empty`}
                  className="hover:bg-fern-50/50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-sm text-fern-900">
                    {order.orderNumber}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-fern-100 text-fern-700">
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-fern-800">
                    {load ? (
                      <div className="flex flex-col gap-1.5 items-start">
                        <span title={`Load ID: ${load.loadCode ?? `${order.orderNumber}-L${load.loadNumber}`}`} className="flex flex-col gap-0.5">
                          <span>L{load.loadNumber}/{order.numberOfLoads}</span>
                          {getEnabledLoadOptionLabels(load).length > 0 && (
                            <span className="text-xs text-fern-500 font-normal">
                              {getEnabledLoadOptionLabels(load).join(", ")}
                            </span>
                          )}
                        </span>
                        <LoadTagPrintButton
                          orderNumber={order.orderNumber}
                          loadNumber={load.loadNumber}
                          numberOfLoads={order.numberOfLoads}
                          className="rounded border border-fern-200 bg-white px-2 py-1 text-xs font-medium text-fern-700 hover:bg-fern-50"
                        />
                      </div>
                    ) : (
                      <span className="text-fern-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {load ? (
                      (() => {
                        const orderPaid = ["ready_for_delivery", "out_for_delivery", "delivered"].includes(order.status);
                        return orderPaid ? (
                          <span className="text-fern-600 text-sm">
                            {LOAD_STATUS_LABEL[load.status] ?? load.status}
                          </span>
                        ) : (
                          <select
                            value={load.status}
                            onChange={(e) =>
                              updateLoad(load.id, { status: e.target.value })
                            }
                            disabled={updatingLoadId === load.id}
                            className={inputClass}
                          >
                            {Object.entries(LOAD_STATUS_LABEL).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                        );
                      })()
                    ) : (
                      <span className="text-fern-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {load ? (
                      (() => {
                        const orderPaid = ["ready_for_delivery", "out_for_delivery", "delivered"].includes(order.status);
                        return orderPaid ? (
                          <span className="text-fern-600 text-sm">
                            {load.location ?? "—"}
                          </span>
                        ) : (
                          <select
                            value={load.location ?? ""}
                            onChange={(e) => {
                              const v = e.target.value || null;
                              setOrders((prev) =>
                                prev.map((o) =>
                                  o.id === order.id
                                    ? {
                                        ...o,
                                        orderLoads: o.orderLoads.map((l) =>
                                          l.id === load.id
                                            ? { ...l, location: v }
                                            : l
                                        ),
                                      }
                                    : o
                                )
                              );
                              updateLoad(load.id, { location: v ?? "" });
                            }}
                            disabled={updatingLoadId === load.id}
                            className={`${inputClass} min-w-[120px]`}
                          >
                        <option value="">—</option>
                        {[
                          ...loadLocationNames,
                          ...(load.location &&
                          !loadLocationNames.includes(load.location)
                            ? [load.location]
                            : []),
                        ].map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                        );
                      })()
                    ) : (
                      <span className="text-fern-400 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const loads = order.orderLoads ?? [];
                      const lastLoad =
                        loads.length > 0 ? loads[loads.length - 1] : null;
                      const isLastLoadRow =
                        load == null ||
                        (lastLoad != null && load.id === lastLoad.id);
                      const orderPaid = [
                        "ready_for_delivery",
                        "out_for_delivery",
                        "delivered",
                      ].includes(order.status);
                      const needsWeightEntry =
                        load != null && !orderPaid && load.status === "cleaned";
                      const showAddLoad =
                        order.status === "in_progress" &&
                        isLastLoadRow &&
                        !needsWeightEntry;

                      const addLoadBtn = showAddLoad ? (
                        <button
                          type="button"
                          onClick={() => addLoadToOrder(order.id)}
                          disabled={addingLoadOrderId === order.id}
                          className="rounded-lg border border-fern-300 bg-fern-50 px-2.5 py-1.5 text-xs font-medium text-fern-800 hover:bg-fern-100 disabled:opacity-50 shrink-0"
                        >
                          {addingLoadOrderId === order.id ? "Adding…" : "+ Add load"}
                        </button>
                      ) : null;

                      if (showAddLoad && addLoadBtn) {
                        return (
                          <div className="flex items-start">{addLoadBtn}</div>
                        );
                      }

                      if (!load) {
                        return (
                          <span className="text-fern-400 text-sm">—</span>
                        );
                      }

                      if (orderPaid) {
                        return (
                          <span className="text-fern-600 text-sm">
                            {load.weightLbs != null
                              ? `${load.weightLbs.toFixed(1)} lbs`
                              : "—"}
                          </span>
                        );
                      }

                      if (load.status === "cleaned") {
                        return (
                          <div className="flex flex-col gap-1.5 items-start">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <input
                                type="number"
                                min="0"
                                step="0.1"
                                value={
                                  weightDraft[load.id] ??
                                  (load.weightLbs != null ? String(load.weightLbs) : "")
                                }
                                onChange={(e) =>
                                  setWeightDraft((prev) => ({
                                    ...prev,
                                    [load.id]: e.target.value,
                                  }))
                                }
                                disabled={updatingLoadId === load.id}
                                className={`${inputClass} w-20`}
                                placeholder="0"
                                aria-label={`Weight for load ${load.loadNumber} (lbs)`}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const raw =
                                    weightDraft[load.id] ??
                                    (load.weightLbs != null
                                      ? String(load.weightLbs)
                                      : "");
                                  const v = parseFloat(raw);
                                  if (raw !== "" && !Number.isNaN(v) && v >= 0) {
                                    updateLoad(load.id, { weightLbs: v });
                                  }
                                }}
                                disabled={updatingLoadId === load.id}
                                className="rounded-lg border border-fern-300 bg-fern-100 px-2 py-1.5 text-xs font-medium text-fern-800 hover:bg-fern-200 disabled:opacity-50"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <span className="text-fern-600 text-sm">
                          {load.weightLbs != null
                            ? `${load.weightLbs.toFixed(1)} lbs`
                            : "—"}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm text-fern-700">
                    <div>
                      {new Date(order.deliveryDate as string).toLocaleDateString()}
                    </div>
                    <div className="text-fern-500 text-xs mt-0.5">
                      {order.deliveryTimeSlot
                        ? getTimeSlotById(order.deliveryTimeSlot)?.label ??
                          order.deliveryTimeSlot
                        : "—"}
                    </div>
                  </td>
                </tr>
              ));
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
