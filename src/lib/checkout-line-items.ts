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
  return `Order ${o.orderNumber} · Pickup ${new Date(o.pickupDate).toLocaleDateString("en-US", { timeZone: "UTC" })}, delivery ${new Date(o.deliveryDate).toLocaleDateString("en-US", { timeZone: "UTC" })}`;
}

/**
 * Build Stripe line items for wash (by weight) and aggregated bulky SKUs.
 * Tax line is not included here — add separately when creating the session.
 * premiumSurchargePerPoundCents is added to the per-pound rate for weight-based charges;
 * bulky items use the base pricePerPoundCents regardless of premium.
 */
export function buildWashAndBulkyStripeLineItems(
  order: OrderDates,
  loads: Array<LoadWithWeight & { bulkyItems?: BulkyItems | unknown | null }>,
  pricePerPoundCents: number,
  premiumSurchargePerPoundCents = 0
): StripeCheckoutLineItem[] {
  const effectivePricePerPoundCents = pricePerPoundCents + premiumSurchargePerPoundCents;
  const totalLbs = loads.reduce(
    (sum, l) => sum + (Number(l.weightLbs) || 0),
    0
  );
  const weightSubtotalCents = Math.round(totalLbs * effectivePricePerPoundCents);
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
    const effectivePerLb = (effectivePricePerPoundCents / 100).toFixed(2);
    items.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Wash and fold (by weight)",
          description: `${totalLbs.toFixed(1)} lb × $${effectivePerLb}/lb · ${ctx}`,
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

/**
 * Cost in cents for a single load (weight + bulky). Used to rank loads for credit assignment.
 * Weight uses the effective rate (base + premium); bulky uses base rate only.
 */
export function computeLoadCostCents(
  load: LoadWithWeight & { bulkyItems?: BulkyItems | unknown | null },
  pricePerPoundCents: number,
  premiumSurchargePerPoundCents = 0
): number {
  const effectivePricePerPoundCents = pricePerPoundCents + premiumSurchargePerPoundCents;
  const weightCents = Math.round((Number(load.weightLbs) || 0) * effectivePricePerPoundCents);
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
  pricePerPoundCents: number,
  premiumSurchargePerPoundCents = 0
): Set<number> {
  if (creditedCount <= 0) return new Set();
  const ranked = loads
    .map((l, i) => ({ i, cost: computeLoadCostCents(l, pricePerPoundCents, premiumSurchargePerPoundCents) }))
    .sort((a, b) => b.cost - a.cost);
  return new Set(ranked.slice(0, creditedCount).map(({ i }) => i));
}

type LoadWithLoadNumber = LoadWithWeight & {
  bulkyItems?: BulkyItems | unknown | null;
  loadNumber?: number | null;
};

/**
 * Build Stripe line items when some loads are covered by credits.
 * Non-credited loads: aggregated at full rate (base + premium).
 * Each credited load:
 *   - Base wash portion: full-price line + matching negative discount (credit covers this).
 *   - Premium surcharge portion (if any): charged as-is — credits never cover premium.
 *   - Bulky items: fully credited (base rate only; premium does not apply to bulky).
 * Tax (taxCents) is computed by the caller on the total payable amount and appended here.
 */
export function buildStripeLineItemsWithCredits(
  order: OrderDates,
  loads: LoadWithLoadNumber[],
  pricePerPoundCents: number,
  creditedIndices: Set<number>,
  taxCents: number,
  premiumSurchargePerPoundCents = 0
): StripeCheckoutLineItem[] {
  const ctx = formatOrderContext(order);
  const items: StripeCheckoutLineItem[] = [];
  const effectivePricePerPoundCents = pricePerPoundCents + premiumSurchargePerPoundCents;

  const nonCredited = loads.filter((_, i) => !creditedIndices.has(i));
  const credited = loads
    .map((l, i) => ({ l, i }))
    .filter(({ i }) => creditedIndices.has(i));

  // Aggregated line for non-credited loads (base + premium combined)
  if (nonCredited.length > 0) {
    const totalLbs = nonCredited.reduce((sum, l) => sum + (Number(l.weightLbs) || 0), 0);
    const weightCents = Math.round(totalLbs * effectivePricePerPoundCents);
    if (weightCents > 0) {
      const effectivePerLb = (effectivePricePerPoundCents / 100).toFixed(2);
      items.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: "Wash and fold (by weight)",
            description: `${totalLbs.toFixed(1)} lb × $${effectivePerLb}/lb · ${ctx}`,
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

  // Per credited load: base portion credited, premium portion still charged
  for (const { l, i } of credited) {
    const loadLabel = `Load ${l.loadNumber ?? i + 1}`;
    const lbs = Number(l.weightLbs) || 0;
    const baseWeightCents = Math.round(lbs * pricePerPoundCents);
    const premiumWeightCents = Math.round(lbs * premiumSurchargePerPoundCents);

    if (baseWeightCents > 0) {
      const basePerLb = (pricePerPoundCents / 100).toFixed(2);
      items.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Wash and fold (${loadLabel})`,
            description: `${lbs.toFixed(1)} lb × $${basePerLb}/lb · ${ctx}`,
          },
          unit_amount: baseWeightCents,
        },
        quantity: 1,
      });
      items.push({
        price_data: {
          currency: "usd",
          product_data: { name: `Free load credit (${loadLabel})`, description: ctx },
          unit_amount: baseWeightCents,
        },
        quantity: -1,
      });
    }

    // Premium surcharge is not covered by the credit
    if (premiumWeightCents > 0) {
      const premiumPerLb = (premiumSurchargePerPoundCents / 100).toFixed(2);
      items.push({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Expedited service surcharge (${loadLabel})`,
            description: `${lbs.toFixed(1)} lb × $${premiumPerLb}/lb surcharge · ${ctx}`,
          },
          unit_amount: premiumWeightCents,
        },
        quantity: 1,
      });
    }

    // Bulky items for this credited load (base rate only; fully credited)
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

  // Tax on the full payable amount (computed by caller)
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
