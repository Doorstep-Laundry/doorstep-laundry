export type OrderStatus =
  | "scheduled"
  | "out_for_pickup"
  | "picked_up"
  | "ready_for_wash"
  | "in_progress"
  | "ready_for_delivery"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  scheduled: ["out_for_pickup", "cancelled"],
  out_for_pickup: ["picked_up", "cancelled"],
  picked_up: ["ready_for_wash", "in_progress", "cancelled"],
  ready_for_wash: ["in_progress", "cancelled"],
  in_progress: ["ready_for_delivery", "cancelled"],
  ready_for_delivery: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

export type LoadStatus =
  | "scheduled"
  | "picked_up"
  | "ready_for_wash"
  | "washing"
  | "drying"
  | "folding"
  | "cleaned"
  | "ready_for_delivery"
  | "out_for_delivery"
  | "delivered";

export type LoadRow = { status: string; location?: string | null; weightLbs?: number | null };

const WASH_IN_PROGRESS_STATUSES = ["washing", "drying", "folding", "cleaned", "ready_for_delivery"];

/**
 * Compute order status from load statuses (for sync when a load is updated).
 * Returns null if order status should not change.
 * - ready_for_wash + any load started washing → in_progress
 * - in_progress + all loads ready_for_delivery → ready_for_delivery
 */
export function getOrderStatusFromLoads(
  currentOrderStatus: OrderStatus,
  loads: LoadRow[]
): OrderStatus | null {
  if (loads.length === 0) return null;
  if (
    currentOrderStatus === "out_for_delivery" ||
    currentOrderStatus === "delivered" ||
    currentOrderStatus === "cancelled"
  ) {
    return null;
  }

  if (currentOrderStatus === "picked_up") {
    const allHaveLocation = loads.every(
      (l) => typeof l.location === "string" && l.location.trim() !== ""
    );
    if (allHaveLocation) return "ready_for_wash";
  }

  if (currentOrderStatus === "in_progress") {
    const allReadyForDelivery = loads.every((l) => l.status === "ready_for_delivery");
    if (allReadyForDelivery) return "ready_for_delivery";
    const allReadyForWash = loads.every((l) => l.status === "ready_for_wash");
    if (allReadyForWash) return "ready_for_wash";
  }

  if (currentOrderStatus === "ready_for_wash") {
    const anyWashing = loads.some((l) => WASH_IN_PROGRESS_STATUSES.includes(l.status));
    if (anyWashing) return "in_progress";
  }

  return null;
}
