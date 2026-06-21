"use client";

import { useState, useEffect, useCallback } from "react";
import { getTimeSlotById } from "@/lib/slots";
import { LoadTagPrintButton } from "@/components/load-tag-print";

type AddressRow = { street: string; city: string; state: string; zip: string };

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  numberOfLoads: number;
  customer: { name: string | null; email: string; phone: string | null };
  pickupAddress?: AddressRow | null;
  deliveryAddress: AddressRow;
  pickupDate?: string;
  deliveryDate?: string;
  pickupTimeSlot?: string | null;
  deliveryTimeSlot?: string | null;
  orderLoads?: { id: string; loadNumber: number; status: string; location?: string | null }[];
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  out_for_pickup: "Out for pickup",
  ready_for_delivery: "Ready for delivery",
  out_for_delivery: "Out for delivery",
};

const LOCATION_INTERVAL_MS = 30_000;

function formatAddress(a: { street: string; city: string; state: string; zip: string }) {
  return `${a.street}, ${a.city}, ${a.state} ${a.zip}`.trim();
}

export function DriverDashboard() {
  const [windowFilter, setWindowFilter] = useState<"now" | "all">("all");
  const [pickups, setPickups] = useState<OrderRow[]>([]);
  const [deliveries, setDeliveries] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPickupIds, setSelectedPickupIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [displayOrderIds, setDisplayOrderIds] = useState<string[]>([]);
  const [runPickupOrders, setRunPickupOrders] = useState<OrderRow[]>([]);
  const [runDeliveryOrders, setRunDeliveryOrders] = useState<OrderRow[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [deliveringId, setDeliveringId] = useState<string | null>(null);
  const [locationSharing, setLocationSharing] = useState(false);
  const [adjustingLoadsOrderId, setAdjustingLoadsOrderId] = useState<string | null>(null);
  const [confirmLoadCounts, setConfirmLoadCounts] = useState<Record<string, number>>({});
  const [confirmingPickupId, setConfirmingPickupId] = useState<string | null>(null);
  const [facilityOrders, setFacilityOrders] = useState<OrderRow[]>([]);
  const [locationInputs, setLocationInputs] = useState<Record<string, string>>({});
  const [savingLocationId, setSavingLocationId] = useState<string | null>(null);
  const [loadLocationNames, setLoadLocationNames] = useState<string[]>([]);

  const fetchOrders = useCallback(async () => {
    const res = await fetch(`/api/driver/orders?window=${windowFilter}`);
    const data = await res.json().catch(() => ({}));
    const allPickups: OrderRow[] = Array.isArray(data.pickups) ? data.pickups : [];
    const allFacility: OrderRow[] = Array.isArray(data.facility) ? data.facility : [];
    setPickups(allPickups);
    setFacilityOrders(allFacility);
    setDeliveries(Array.isArray(data.deliveries) ? data.deliveries : []);
    // Seed confirm load counts for any out_for_pickup orders not yet in state
    setConfirmLoadCounts((prev) => {
      const next = { ...prev };
      for (const o of allPickups) {
        if (o.status === "out_for_pickup" && !(o.id in next)) {
          next[o.id] = o.numberOfLoads;
        }
      }
      return next;
    });
    // Seed location inputs from saved values (don't overwrite in-progress edits)
    setLocationInputs((prev) => {
      const next = { ...prev };
      for (const o of allFacility) {
        for (const load of o.orderLoads ?? []) {
          if (!(load.id in next) && load.location) {
            next[load.id] = load.location;
          }
        }
      }
      return next;
    });
  }, [windowFilter]);

  const fetchRun = useCallback(async () => {
    const res = await fetch("/api/driver/run");
    const data = await res.json().catch(() => ({}));
    if (data.runId) {
      setRunPickupOrders(Array.isArray(data.pickupOrders) ? data.pickupOrders : []);
      setRunDeliveryOrders(Array.isArray(data.deliveryOrders) ? data.deliveryOrders : []);
    } else {
      setRunPickupOrders([]);
      setRunDeliveryOrders([]);
    }
  }, []);

  useEffect(() => {
    fetch("/api/load-locations")
      .then((res) => res.json())
      .then((data) => {
        setLoadLocationNames(
          Array.isArray(data) ? data.map((loc: { name: string }) => loc.name) : []
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchOrders(), fetchRun()]).finally(() => setLoading(false));
  }, [fetchOrders, fetchRun]);

  const scheduledPickups = pickups.filter((o) => o.status === "scheduled");
  const activePickups = pickups.filter((o) => o.status === "out_for_pickup");

  const deliveryOrdersAvailable = deliveries.filter(
    (o) => o.status === "ready_for_delivery"
  );

  useEffect(() => {
    if (
      deliveryOrdersAvailable.length > 0 &&
      displayOrderIds.length === 0
    ) {
      setDisplayOrderIds(deliveryOrdersAvailable.map((o) => o.id));
    }
  }, [deliveryOrdersAvailable, displayOrderIds.length]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePickupSelect = (id: string) => {
    setSelectedPickupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPickups = () => {
    if (selectedPickupIds.size === scheduledPickups.length) {
      setSelectedPickupIds(new Set());
    } else {
      setSelectedPickupIds(new Set(scheduledPickups.map((o) => o.id)));
    }
  };

  const selectAll = () => {
    if (selectedIds.size === deliveryOrdersAvailable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deliveryOrdersAvailable.map((o) => o.id)));
    }
  };

  const handleOptimize = async () => {
    const ids = selectedIds.size
      ? Array.from(selectedIds)
      : deliveryOrdersAvailable.map((o) => o.id);
    if (ids.length === 0) return;
    setOptimizing(true);
    try {
      const res = await fetch("/api/driver/optimize-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.orderIds && Array.isArray(data.orderIds)) {
        setDisplayOrderIds(data.orderIds);
        setSelectedIds(new Set(data.orderIds));
      }
    } finally {
      setOptimizing(false);
    }
  };

  const handleStartRoute = async () => {
    const pickupIds = Array.from(selectedPickupIds);
    const deliveryIds = displayOrderIds.filter(
      (id) => selectedIds.has(id) || selectedIds.size === 0
    ).filter((id) => deliveryOrdersAvailable.some((o) => o.id === id));
    const hasPickups = pickupIds.length > 0;
    const hasDeliveries = deliveryIds.length > 0;
    if (!hasPickups && !hasDeliveries) return;
    const parts: string[] = [];
    if (hasPickups) parts.push(`${pickupIds.length} pickup(s)`);
    if (hasDeliveries) parts.push(`${deliveryIds.length} delivery stop(s)`);
    if (!confirm(`Start route with ${parts.join(" and ")}?`)) return;
    setStarting(true);
    try {
      if (hasPickups) {
        const res = await fetch("/api/driver/start-pickup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIds: pickupIds }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.error ?? "Failed to start pickup route");
          return;
        }
        setSelectedPickupIds(new Set());
      }
      if (hasDeliveries) {
        const res = await fetch("/api/driver/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderIds: deliveryIds }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          alert(err.error ?? "Failed to start delivery run");
          return;
        }
        await res.json();
        setLocationSharing(true);
        await fetchRun();
      }
      await fetchOrders();
    } finally {
      setStarting(false);
    }
  };

  const handleConfirmPickup = async (orderId: string) => {
    const numberOfLoads = confirmLoadCounts[orderId] ?? 1;
    setConfirmingPickupId(orderId);
    try {
      const res = await fetch("/api/driver/confirm-pickup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: [{ orderId, numberOfLoads }] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to confirm pickup");
        return;
      }
      setConfirmLoadCounts((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      await fetchOrders();
    } finally {
      setConfirmingPickupId(null);
    }
  };

  const handleSaveLocation = async (loadId: string, location: string) => {
    setSavingLocationId(loadId);
    try {
      const res = await fetch(`/api/order-loads/${loadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to save location");
        return;
      }
      await fetchOrders();
    } finally {
      setSavingLocationId(null);
    }
  };

  async function adjustLoads(orderId: string, action: "add" | "remove") {
    setAdjustingLoadsOrderId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/loads`, {
        method: action === "add" ? "POST" : "DELETE",
      });
      const err = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof err.error === "string" ? err.error : "Failed to update loads");
        return;
      }
      await Promise.all([fetchOrders(), fetchRun()]);
    } finally {
      setAdjustingLoadsOrderId(null);
    }
  }

  const handleMarkDelivered = async (orderId: string) => {
    setDeliveringId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "delivered" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Failed to update");
        return;
      }
      await fetchOrders();
      await fetchRun();
    } finally {
      setDeliveringId(null);
    }
  };

  useEffect(() => {
    if (!locationSharing || typeof navigator === "undefined" || !navigator.geolocation) return;
    const sendLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetch("/api/driver/location", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          }).catch(() => {});
        },
        () => {}
      );
    };
    sendLocation();
    const interval = setInterval(sendLocation, LOCATION_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [locationSharing]);

  const hasRun = (runPickupOrders.length + runDeliveryOrders.length) > 0;
  const runStops: { type: "pickup" | "delivery"; order: OrderRow }[] = [
    ...runPickupOrders.map((order) => ({ type: "pickup" as const, order })),
    ...runDeliveryOrders.map((order) => ({ type: "delivery" as const, order })),
  ];

  const inputClass =
    "rounded-lg border border-fern-200 bg-white px-3 py-2 text-sm text-fern-900 focus:border-fern-500 focus:outline-none focus:ring-2 focus:ring-fern-500/20";

  if (loading) {
    return (
      <div className="rounded-2xl border border-fern-200/80 bg-white p-8 text-center text-fern-500">
        Loading…
      </div>
    );
  }

  const orderedList = displayOrderIds.length
    ? displayOrderIds.map((id) =>
        deliveryOrdersAvailable.find((o) => o.id === id)
      ).filter((o): o is OrderRow => o != null)
    : deliveryOrdersAvailable;

  function formatOrderDate(dateStr: string | undefined) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { timeZone: "UTC" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-fern-700">Show:</span>
        <label className="flex items-center gap-2 text-sm text-fern-700">
          <input
            type="radio"
            name="window"
            checked={windowFilter === "all"}
            onChange={() => setWindowFilter("all")}
            className="rounded-full border-fern-300 text-fern-600"
          />
          All
        </label>
        <label className="flex items-center gap-2 text-sm text-fern-700">
          <input
            type="radio"
            name="window"
            checked={windowFilter === "now"}
            onChange={() => setWindowFilter("now")}
            className="rounded-full border-fern-300 text-fern-600"
          />
          Now (in time window)
        </label>
        <span className="text-fern-300">|</span>
        <button
          type="button"
          onClick={handleOptimize}
          disabled={optimizing || (displayOrderIds.length <= 1 && selectedIds.size <= 1)}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${inputClass}`}
        >
          {optimizing ? "Optimizing…" : "Optimize route"}
        </button>
        <button
          type="button"
          onClick={handleStartRoute}
          disabled={
            starting ||
            (selectedPickupIds.size === 0 &&
              (selectedIds.size === 0
                ? deliveryOrdersAvailable.length === 0
                : !deliveryOrdersAvailable.some((o) => selectedIds.has(o.id))))
          }
          className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600 disabled:opacity-50"
        >
          {starting ? "Starting…" : "Start route"}
        </button>
      </div>

      {locationSharing && (
        <div className="rounded-lg border border-fern-200 bg-fern-50 px-4 py-2 text-sm text-fern-700">
          Sharing location with admin (updates every 30s).
        </div>
      )}

      {/* Active pickup stops — orders the driver is en route to pick up */}
      {activePickups.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-white shadow-sm overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-semibold text-amber-800 border-b border-amber-200 bg-amber-50">
            En route to pickup
          </h2>
          <p className="px-4 py-2 text-xs text-fern-500 border-b border-fern-100">
            Confirm each pickup when you arrive. Adjust the bag count if it differs from what the customer estimated.
          </p>
          <ul className="divide-y divide-fern-200">
            {activePickups.map((order) => {
              const loadCount = confirmLoadCounts[order.id] ?? order.numberOfLoads;
              return (
                <li key={order.id} className="px-4 py-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-sm font-medium text-fern-900">
                      {order.orderNumber}
                    </span>
                    <p className="text-sm text-fern-600 mt-0.5">
                      {order.pickupAddress ? formatAddress(order.pickupAddress) : "—"}
                    </p>
                    <p className="text-xs text-fern-500">
                      {order.customer.name ?? order.customer.email}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-fern-500">Bags</span>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmLoadCounts((prev) => ({
                            ...prev,
                            [order.id]: Math.max(1, (prev[order.id] ?? order.numberOfLoads) - 1),
                          }))
                        }
                        disabled={loadCount <= 1}
                        className="rounded border border-fern-200 bg-white px-2 py-0.5 text-sm text-fern-700 hover:bg-fern-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label="Remove one bag"
                      >
                        −
                      </button>
                      <span className="text-sm font-medium text-fern-800 tabular-nums min-w-[1.25rem] text-center">
                        {loadCount}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmLoadCounts((prev) => ({
                            ...prev,
                            [order.id]: (prev[order.id] ?? order.numberOfLoads) + 1,
                          }))
                        }
                        className="rounded border border-fern-200 bg-white px-2 py-0.5 text-sm text-fern-700 hover:bg-fern-50"
                        aria-label="Add one bag"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleConfirmPickup(order.id)}
                      disabled={confirmingPickupId === order.id}
                      className="rounded-lg bg-fern-500 text-white px-4 py-2 text-sm font-medium hover:bg-fern-600 disabled:opacity-50"
                    >
                      {confirmingPickupId === order.id ? "Confirming…" : "Confirm pickup"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Facility dropoff — assign a shelf location to each load */}
      {facilityOrders.length > 0 && (
        <div className="rounded-2xl border border-sky-200 bg-white shadow-sm overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-semibold text-sky-800 border-b border-sky-200 bg-sky-50">
            At facility — assign locations
          </h2>
          <p className="px-4 py-2 text-xs text-fern-500 border-b border-fern-100">
            Assign a shelf location to every load. The order moves to the wash queue automatically once all loads are placed.
          </p>
          <ul className="divide-y divide-fern-200">
            {facilityOrders.map((order) => {
              const loads = order.orderLoads ?? [];
              const assignedCount = loads.filter((l) => l.location && l.location.trim() !== "").length;
              const allAssigned = assignedCount === loads.length && loads.length > 0;
              return (
                <li key={order.id} className="px-4 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-sm font-medium text-fern-900">
                        {order.orderNumber}
                      </span>
                      <span className="ml-2 text-xs text-fern-500">
                        {order.customer.name ?? order.customer.email}
                      </span>
                    </div>
                    <span className={`text-xs font-medium tabular-nums ${allAssigned ? "text-fern-600" : "text-sky-600"}`}>
                      {assignedCount}/{loads.length} placed
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {loads.map((load) => {
                      const inputVal = locationInputs[load.id] ?? load.location ?? "";
                      const isSaved = !!(load.location && load.location.trim() !== "");
                      const isSaving = savingLocationId === load.id;
                      return (
                        <li key={load.id} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-fern-600 w-14 shrink-0">
                            Load {load.loadNumber}
                          </span>
                          <select
                            value={inputVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLocationInputs((prev) => ({ ...prev, [load.id]: val }));
                              if (val) handleSaveLocation(load.id, val);
                            }}
                            disabled={isSaving}
                            className="flex-1 rounded-lg border border-fern-200 bg-white px-3 py-1.5 text-sm text-fern-900 focus:border-fern-500 focus:outline-none focus:ring-2 focus:ring-fern-500/20 disabled:opacity-50"
                          >
                            <option value="">— select location —</option>
                            {loadLocationNames.map((name) => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                            {inputVal && !loadLocationNames.includes(inputVal) && (
                              <option value={inputVal}>{inputVal}</option>
                            )}
                          </select>
                          <span className="w-5 shrink-0 text-center">
                            {isSaving ? (
                              <span className="text-fern-400 text-xs">…</span>
                            ) : isSaved ? (
                              <span className="text-fern-500 text-sm">✓</span>
                            ) : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {hasRun ? (
        <div className="rounded-2xl border border-fern-200/80 bg-white shadow-sm overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-semibold text-fern-800 border-b border-fern-200">
            Current run – Deliveries
          </h2>
          <ul className="divide-y divide-fern-200">
            {runStops.map(({ type, order }, index) => (
              <li key={order.id} className="px-4 py-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="font-mono text-sm font-medium text-fern-900">
                    Stop {index + 1}: {order.orderNumber}
                    {type === "pickup" ? (
                      <span className="ml-2 rounded-full bg-fern-100 px-2 py-0.5 text-xs font-medium text-fern-700">
                        Pickup
                      </span>
                    ) : (
                      <span className="ml-2 rounded-full bg-fern-100 px-2 py-0.5 text-xs font-medium text-fern-700">
                        Delivery
                      </span>
                    )}
                  </span>
                  <p className="text-sm text-fern-600 mt-0.5">
                    {type === "pickup" && order.pickupAddress
                      ? formatAddress(order.pickupAddress)
                      : formatAddress(order.deliveryAddress)}
                  </p>
                  <p className="text-xs text-fern-500">
                    {order.customer.name ?? order.customer.email}
                  </p>
                </div>
                {type === "delivery" ? (
                  <button
                    type="button"
                    onClick={() => handleMarkDelivered(order.id)}
                    disabled={deliveringId === order.id || order.status === "delivered"}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      order.status === "delivered"
                        ? "bg-fern-100 text-fern-500 cursor-default"
                        : "bg-fern-500 text-white hover:bg-fern-600 disabled:opacity-50"
                    }`}
                  >
                    {order.status === "delivered"
                      ? "Delivered"
                      : deliveringId === order.id
                        ? "Updating…"
                        : "Mark delivered"}
                  </button>
                ) : (
                  <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:max-w-md">
                    <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <span className="text-xs text-fern-500">Loads</span>
                      <div className="flex flex-wrap items-center gap-1 justify-end">
                        <span className="text-sm font-medium text-fern-800 tabular-nums min-w-[1.25rem]">
                          {order.numberOfLoads ?? order.orderLoads?.length ?? 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => adjustLoads(order.id, "remove")}
                          disabled={
                            adjustingLoadsOrderId === order.id ||
                            (order.numberOfLoads ?? order.orderLoads?.length ?? 1) <= 1
                          }
                          className="rounded border border-fern-200 bg-white px-2 py-0.5 text-sm text-fern-700 hover:bg-fern-50 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Remove one load"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustLoads(order.id, "add")}
                          disabled={adjustingLoadsOrderId === order.id}
                          className="rounded border border-fern-200 bg-white px-2 py-0.5 text-sm text-fern-700 hover:bg-fern-50 disabled:opacity-40"
                          aria-label="Add one load"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="border-t border-fern-100 pt-2 w-full">
                      <p className="text-xs text-fern-500 mb-1.5 text-right sm:text-right">
                        Print tags
                      </p>
                      {(order.orderLoads ?? []).length === 0 ? (
                        <p className="text-xs text-fern-500 text-right">
                          No load rows yet. Confirm pickup or refresh.
                        </p>
                      ) : (
                        <ul className="flex flex-wrap gap-1.5 justify-end">
                          {[...(order.orderLoads ?? [])]
                            .sort((a, b) => a.loadNumber - b.loadNumber)
                            .map((l) => (
                              <li key={l.id}>
                                <LoadTagPrintButton
                                  orderNumber={order.orderNumber}
                                  loadNumber={l.loadNumber}
                                  numberOfLoads={
                                    order.numberOfLoads ??
                                    order.orderLoads?.length ??
                                    1
                                  }
                                  buttonLabel={`Print L${l.loadNumber}`}
                                  className="rounded border border-fern-200 bg-white px-2 py-1 text-xs font-medium text-fern-700 hover:bg-fern-50"
                                />
                              </li>
                            ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {scheduledPickups.length > 0 && (
        <div className="rounded-2xl border border-fern-200/80 bg-white shadow-sm overflow-hidden p-4">
          <div className="py-3 border-b border-fern-200 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-fern-800">
              Pickups (scheduled)
            </h2>
            <button
              type="button"
              onClick={selectAllPickups}
              className="text-sm font-medium text-fern-600 hover:text-fern-900"
            >
              {selectedPickupIds.size === scheduledPickups.length ? "Deselect all" : "Select all"}
            </button>
          </div>
          <p className="py-2 text-xs text-fern-500 border-b border-fern-100">
            Select orders and tap <span className="font-medium text-fern-600">Start route</span>. When you arrive at each customer, confirm the pickup in the <span className="font-medium text-fern-600">En route to pickup</span> section above.
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-fern-200">
              <thead>
                <tr>
                  <th className="px-2 py-2 text-left text-xs font-medium text-fern-500 w-8">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-fern-500">Order</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-fern-500">Pickup address</th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-fern-500">Date / time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-fern-200">
                {scheduledPickups.map((order) => (
                  <tr key={order.id}>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedPickupIds.has(order.id)}
                        onChange={() => togglePickupSelect(order.id)}
                        className="rounded border-fern-300"
                      />
                    </td>
                    <td className="px-2 py-2 font-mono text-sm text-fern-900">
                      {order.orderNumber}
                    </td>
                    <td className="px-2 py-2 text-sm text-fern-600">
                      {order.pickupAddress
                        ? formatAddress(order.pickupAddress)
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-sm text-fern-600">
                      {formatOrderDate(order.pickupDate)}{" "}
                      {order.pickupTimeSlot
                        ? getTimeSlotById(order.pickupTimeSlot)?.label ?? order.pickupTimeSlot
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-fern-200/80 bg-white p-4 shadow-sm">
        <div className="py-3 border-b border-fern-200 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-fern-800">Orders available for delivery</h2>
          <button
            type="button"
            onClick={selectAll}
            className="text-sm font-medium text-fern-600 hover:text-fern-900"
          >
            {selectedIds.size === deliveryOrdersAvailable.length ? "Deselect all" : "Select all"}
          </button>
        </div>
        <p className="py-2 text-xs text-fern-500 border-b border-fern-100 mb-3">
          Only orders with all loads ready can be delivered. Use the controls above to select orders, optimize route, then Start route.
        </p>
        {deliveryOrdersAvailable.length === 0 ? (
          <p className="text-sm text-fern-500">No orders ready for delivery.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-fern-200">
                <thead>
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium text-fern-500 w-8">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-fern-500">Order</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-fern-500">Address</th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-fern-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-fern-200">
                  {orderedList.map((order) => (
                    <tr key={order.id}>
                      <td className="px-2 py-2">
                        {order.status === "ready_for_delivery" ? (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(order.id)}
                            onChange={() => toggleSelect(order.id)}
                            className="rounded border-fern-300"
                          />
                        ) : (
                          <span className="text-fern-400">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 font-mono text-sm text-fern-900">
                        {order.orderNumber}
                      </td>
                      <td className="px-2 py-2 text-sm text-fern-600">
                        {formatAddress(order.deliveryAddress)}
                      </td>
                      <td className="px-2 py-2">
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-fern-100 text-fern-700">
                          {STATUS_LABEL[order.status] ?? order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {!locationSharing && hasRun && (
        <button
          type="button"
          onClick={() => setLocationSharing(true)}
          className="rounded-lg border border-fern-200 bg-white px-4 py-2 text-sm font-medium text-fern-700 hover:bg-fern-50"
        >
          Share location with admin
        </button>
      )}
    </div>
  );
}
