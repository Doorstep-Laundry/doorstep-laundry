/**
 * Single source of truth for order status transitions (manual API) and
 * load-driven order sync rules. Used by API routes and unit tests.
 */

export type OrderStatus =
  | "scheduled"
  | "picked_up"
  | "ready_for_wash"
  | "in_progress"
  | "waiting_for_payment"
  | "ready_for_delivery"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

/** Allowed manual transitions from each order status. */
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  scheduled: ["picked_up", "cancelled"],
  picked_up: ["ready_for_wash", "in_progress", "cancelled"],
  ready_for_wash: ["in_progress", "cancelled"],
  in_progress: ["ready_for_delivery", "out_for_delivery", "cancelled"],
  waiting_for_payment: ["ready_for_delivery", "cancelled"],
  ready_for_delivery: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

export type LoadStatus =
  | "ready_for_pickup"
  | "incoming"
  | "ready_for_wash"
  | "washing"
  | "drying"
  | "folding"
  | "cleaned"
  | "ready_for_delivery"
  | "out_for_delivery"
  | "delivered";

export type LoadRow = { status: string; location?: string | null; weightLbs?: number | null };

/**
 * Compute order status from load statuses (for sync when a load is updated).
 * Returns null if order status should not change.
 * - picked_up → ready_for_wash when all loads have a location (shelf).
 * - ready_for_wash → in_progress when any load is washing.
 * - in_progress: any load in incoming, ready_for_wash, washing, drying, folding.
 * - in_progress → waiting_for_payment when all loads are "cleaned" and have weightLbs (balance set, delivery can proceed independently).
 * - ready_for_delivery: manual transition from waiting_for_payment, or auto via Stripe webhook when payment received first.
 */
export function getOrderStatusFromLoads(
  currentOrderStatus: OrderStatus,
  loads: LoadRow[]
): OrderStatus | null {
  if (loads.length === 0) return null;
  const canSet =
    currentOrderStatus !== "out_for_delivery" &&
    currentOrderStatus !== "delivered" &&
    currentOrderStatus !== "cancelled";

  const allHaveLocation = loads.every((l) => (l.location ?? "").trim() !== "");
  const anyWashing =
    loads.some((l) =>
      ["incoming", "ready_for_wash", "washing", "drying", "folding"].includes(l.status)
    );
  const allCleanedWithWeight =
    loads.length > 0 &&
    loads.every(
      (l) => l.status === "cleaned" && l.weightLbs != null && l.weightLbs > 0
    );
  const allReadyForDelivery = loads.every((l) => l.status === "ready_for_delivery");

  if (currentOrderStatus === "waiting_for_payment") return null;
  const canGoToPayment =
    (currentOrderStatus === "in_progress" || currentOrderStatus === "ready_for_wash") &&
    allCleanedWithWeight &&
    canSet;
  if (canGoToPayment) return "waiting_for_payment";
  if (allReadyForDelivery && canSet) return "ready_for_delivery";
  if (currentOrderStatus === "ready_for_wash" && anyWashing && canSet) return "in_progress";
  if (currentOrderStatus === "picked_up") {
    if (allHaveLocation && canSet) return "ready_for_wash";
    return null;
  }
  if (anyWashing && canSet) return "in_progress";
  return null;
}
