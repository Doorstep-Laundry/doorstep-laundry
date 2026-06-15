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

export function getDerivedOrderStatus(
  orderStatus: string,
  loadStatuses: LoadStatus[]
): string {
  if (loadStatuses.length === 0) return orderStatus;
  const allReady = loadStatuses.every((s) => s === "ready_for_delivery");
  if (allReady) return "ready_for_delivery";
  const anyStarted = loadStatuses.some(
    (s) =>
      s === "ready_for_wash" ||
      s === "washing" ||
      s === "drying" ||
      s === "folding" ||
      s === "cleaned"
  );
  if (anyStarted) return "in_progress";
  return orderStatus;
}

export const DERIVED_STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  picked_up: "Picked up",
  ready_for_wash: "Ready for wash",
  in_progress: "In progress",
  ready_for_delivery: "Ready for delivery",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
