/**
 * Stripe Checkout Session line_items: weight subtotal + per-type bulky lines + optional tax.
 */

import {
  computeBulkyItemsCents,
  getAggregatedBulkyLineItems,
  mergeBulkyItemsAcrossLoads,
  type BulkyItems,
} from "./bulky-items";
import type { LoadWithWeight } from "./order-total";

export type StripeCheckoutLineItem = {
  price_data: {
    currency: "usd";
    product_data: {
      name: string;
      description?: string;
    };
    unit_amount: number;
  };
  quantity: number;
};

type OrderDates = {
  orderNumber: string;
  pickupDate: Date;
  deliveryDate: Date;
};

function formatOrderContext(o: OrderDates): string {
  return `Order ${o.orderNumber} · Pickup ${new Date(o.pickupDate).toLocaleDateString()}, delivery ${new Date(o.deliveryDate).toLocaleDateString()}`;
}

/**
 * Build Stripe line items for wash (by weight) and aggregated bulky SKUs.
 * Tax line is not included here — add separately when creating the session.
 */
export function buildWashAndBulkyStripeLineItems(
  order: OrderDates,
  loads: Array<LoadWithWeight & { bulkyItems?: BulkyItems | unknown | null }>,
  pricePerPoundCents: number
): StripeCheckoutLineItem[] {
  const totalLbs = loads.reduce(
    (sum, l) => sum + (Number(l.weightLbs) || 0),
    0
  );
  const weightSubtotalCents = Math.round(totalLbs * pricePerPoundCents);
  const mergedBulky = mergeBulkyItemsAcrossLoads(
    loads.map((l) => ({ bulkyItems: l.bulkyItems as BulkyItems | null }))
  );
  const bulkyLines = getAggregatedBulkyLineItems(
    mergedBulky,
    pricePerPoundCents
  );

  const items: StripeCheckoutLineItem[] = [];
  const ctx = formatOrderContext(order);

  if (weightSubtotalCents > 0) {
    const perLb = (pricePerPoundCents / 100).toFixed(2);
    items.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Wash and fold (by weight)",
          description: `${totalLbs.toFixed(1)} lb × $${perLb}/lb · ${ctx}`,
        },
        unit_amount: weightSubtotalCents,
      },
      quantity: 1,
    });
  }

  for (const line of bulkyLines) {
    items.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: line.name,
          description: `Bulky item · ${ctx}`,
        },
        unit_amount: line.unitCents,
      },
      quantity: line.qty,
    });
  }

  return items;
}

/** Cost in cents for a single load (weight + bulky). Used to rank loads for credit assignment. */
export function computeLoadCostCents(
  load: LoadWithWeight & { bulkyItems?: BulkyItems | unknown | null },
  pricePerPoundCents: number
): number {
  const weightCents = Math.round((Number(load.weightLbs) || 0) * pricePerPoundCents);
  const bulkyCents = computeBulkyItemsCents(load.bulkyItems as BulkyItems | null, pricePerPoundCents);
  return weightCents + bulkyCents;
}

/**
 * Return the set of indices (into `loads`) for the N most-expensive loads.
 * These are the loads that should receive the credit discount.
 */
export function pickCreditedLoadIndices(
  loads: Array<LoadWithWeight & { bulkyItems?: BulkyItems | unknown | null }>,
  creditedCount: number,
  pricePerPoundCents: number
): Set<number> {
  if (creditedCount <= 0) return new Set();
  const ranked = loads
    .map((l, i) => ({ i, cost: computeLoadCostCents(l, pricePerPoundCents) }))
    .sort((a, b) => b.cost - a.cost);
  return new Set(ranked.slice(0, creditedCount).map(({ i }) => i));
}

type LoadWithLoadNumber = LoadWithWeight & {
  bulkyItems?: BulkyItems | unknown | null;
  loadNumber?: number | null;
};

/**
 * Build Stripe line items when some loads are covered by credits.
 * Non-credited loads: aggregated as before.
 * Each credited load: full-price line item + matching negative discount.
 * Tax is applied only to the non-credited subtotal (passed in as taxCents).
 */
export function buildStripeLineItemsWithCredits(
  order: OrderDates,
  loads: LoadWithLoadNumber[],
  pricePerPoundCents: number,
  creditedIndices: Set<number>,
  taxCents: number
): StripeCheckoutLineItem[] {
  const ctx = formatOrderContext(order);
  const items: StripeCheckoutLineItem[] = [];
  const perLb = (pricePerPoundCents / 100).toFixed(2);

  const nonCredited = loads.filter((_, i) => !creditedIndices.has(i));
  const credited = loads
    .map((l, i) => ({ l, i }))
    .filter(({ i }) => creditedIndices.has(i));

  // Aggregated line for non-credited loads
  if (nonCredited.length > 0) {
    const totalLbs = nonCredited.reduce((sum, l) => sum + (Number(l.weightLbs) || 0), 0);
    const weightCents = Math.round(totalLbs * pricePerPoundCents);
    if (weightCents > 0) {
      items.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Wash and fold (by weight)",
            description: `${totalLbs.toFixed(1)} lb × $${perLb}/lb · ${ctx}`,
          },
          unit_amount: weightCents,
        },
        quantity: 1,
      });
    }
    const mergedBulky = mergeBulkyItemsAcrossLoads(
      nonCredited.map((l) => ({ bulkyItems: l.bulkyItems as BulkyItems | null }))
    );
    for (const line of getAggregatedBulkyLineItems(mergedBulky, pricePerPoundCents)) {
      items.push({
        price_data: {
          currency: "usd",
          product_data: { name: line.name, description: `Bulky item · ${ctx}` },
          unit_amount: line.unitCents,
        },
        quantity: line.qty,
      });
    }
  }

  // Per credited load: full price + negative discount
  for (const { l, i } of credited) {
    const loadLabel = `Load ${l.loadNumber ?? i + 1}`;
    const lbs = Number(l.weightLbs) || 0;
    const weightCents = Math.round(lbs * pricePerPoundCents);

    if (weightCents > 0) {
      items.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Wash and fold (${loadLabel})`,
            description: `${lbs.toFixed(1)} lb × $${perLb}/lb · ${ctx}`,
          },
          unit_amount: weightCents,
        },
        quantity: 1,
      });
      items.push({
        price_data: {
          currency: "usd",
          product_data: { name: `Free load credit (${loadLabel})`, description: ctx },
          unit_amount: weightCents,
        },
        quantity: -1,
      });
    }

    // Bulky items for this credited load
    const bulkyLines = getAggregatedBulkyLineItems(
      l.bulkyItems as BulkyItems | null,
      pricePerPoundCents
    );
    for (const line of bulkyLines) {
      items.push({
        price_data: {
          currency: "usd",
          product_data: { name: `${line.name} (${loadLabel})`, description: `Bulky item · ${ctx}` },
          unit_amount: line.unitCents,
        },
        quantity: line.qty,
      });
      items.push({
        price_data: {
          currency: "usd",
          product_data: { name: `Free load credit – ${line.name} (${loadLabel})`, description: ctx },
          unit_amount: line.unitCents * line.qty,
        },
        quantity: -1,
      });
    }
  }

  // Tax on non-credited subtotal only
  if (taxCents > 0) {
    items.push({
      price_data: {
        currency: "usd",
        product_data: { name: "NMGRT tax", description: "New Mexico Gross Receipts Tax" },
        unit_amount: taxCents,
      },
      quantity: 1,
    });
  }

  return items;
}
