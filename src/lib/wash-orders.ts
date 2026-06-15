import type { OrderStatus } from "@prisma/client";

/** Order statuses shown on the Wash page. */
export const WASH_VISIBLE_ORDER_STATUSES: OrderStatus[] = [
  "ready_for_wash",
  "in_progress",
  "picked_up",
];

/** Table sort: ready_for_wash → in_progress → picked_up (last). */
const STATUS_SORT_INDEX: Record<string, number> = {
  ready_for_wash: 0,
  in_progress: 1,
  picked_up: 2,
};

/** Sort by wash status order, then pickup date ascending. */
export function sortOrdersForWash<T extends { status: string; pickupDate: Date | string }>(
  orders: T[]
): T[] {
  return [...orders].sort((a, b) => {
    const ia = STATUS_SORT_INDEX[a.status] ?? 999;
    const ib = STATUS_SORT_INDEX[b.status] ?? 999;
    if (ia !== ib) return ia - ib;
    return new Date(a.pickupDate).getTime() - new Date(b.pickupDate).getTime();
  });
}

export function isWashVisibleOrderStatus(status: string): status is OrderStatus {
  return (WASH_VISIBLE_ORDER_STATUSES as readonly string[]).includes(status);
}
