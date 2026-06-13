import { prisma } from "./db";
import { getPastDueGracePeriodDays } from "./settings";
import { OrderStatus } from "@prisma/client";

export type PastDueOrder = {
  id: string;
  orderNumber: string;
  totalCents: number;
  deliveryDate: Date;
};

const PAST_DUE_STATUSES: OrderStatus[] = [
  OrderStatus.waiting_for_payment,
  OrderStatus.ready_for_delivery,
  OrderStatus.out_for_delivery,
  OrderStatus.delivered,
];

/**
 * Returns unpaid orders whose deliveryDate has passed the configured grace period.
 * Used to block new scheduling when a customer has an outstanding balance.
 */
export async function getPastDueOrders(customerId: string): Promise<PastDueOrder[]> {
  const gracePeriodDays = await getPastDueGracePeriodDays();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - gracePeriodDays);
  cutoff.setHours(23, 59, 59, 999);

  return prisma.order.findMany({
    where: {
      customerId,
      stripePaymentId: null,
      status: { in: PAST_DUE_STATUSES },
      deliveryDate: { lt: cutoff },
    },
    select: {
      id: true,
      orderNumber: true,
      totalCents: true,
      deliveryDate: true,
    },
    orderBy: { deliveryDate: "asc" },
  });
}
