/**
 * Order totals: weight × $/lb + bulky (×20 lb equivalent / n per item type); NMGRT on subtotal unless exempt.
 * subtotalCents = weightSubtotalCents + bulkySubtotalCents
 * taxCents = exempt ? 0 : round(subtotalCents × grtPercent / 100)
 * totalCents = subtotalCents + taxCents
 */

import {
  computeBulkyItemsCents,
  type BulkyItems,
} from "./bulky-items";

export type LoadWithWeight = {
  weightLbs?: number | null;
  bulkyItems?: BulkyItems | unknown | null;
};

export type OrderPricingSource = {
  orderPricePerPoundCents?: number | null;
  nmgrtExempt?: boolean | null;
};

export type CustomerPricingSource = {
  customPricePerPoundCents?: number | null;
  nmgrtExempt?: boolean;
} | null;

/**
 * Resolve effective price per pound and NMGRT exempt from order > customer > defaults.
 */
export function getEffectivePricing(
  order: OrderPricingSource,
  customer: CustomerPricingSource,
  defaultPricePerPoundCents: number
): { pricePerPoundCents: number; nmgrtExempt: boolean } {
  const pricePerPoundCents =
    order.orderPricePerPoundCents ??
    customer?.customPricePerPoundCents ??
    defaultPricePerPoundCents;
  const nmgrtExempt =
    order.nmgrtExempt ?? customer?.nmgrtExempt ?? false;
  return { pricePerPoundCents, nmgrtExempt };
}

/**
 * Compute subtotal (weight + bulky), tax (NMGRT unless exempt), and total.
 * Use when setting order.totalCents (weigh-in, checkout, resend payment).
 * premiumSurchargePerPoundCents is added to the per-pound rate for weight-based charges only.
 * Bulky items use the base pricePerPoundCents regardless of premium.
 */
export function computeOrderTotalWithTax(
  loads: LoadWithWeight[],
  pricePerPoundCents: number,
  grtPercent: number,
  nmgrtExempt = false,
  premiumSurchargePerPoundCents = 0
): {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  weightSubtotalCents: number;
  bulkySubtotalCents: number;
} {
  const effectivePricePerPoundCents = pricePerPoundCents + premiumSurchargePerPoundCents;
  const totalLbs = loads.reduce(
    (sum, l) => sum + (Number(l.weightLbs) || 0),
    0
  );
  const weightSubtotalCents = Math.round(totalLbs * effectivePricePerPoundCents);
  const bulkySubtotalCents = loads.reduce(
    (sum, l) =>
      sum +
      computeBulkyItemsCents(
        l.bulkyItems as BulkyItems | null,
        pricePerPoundCents
      ),
    0
  );
  const subtotalCents = weightSubtotalCents + bulkySubtotalCents;
  const taxCents = nmgrtExempt
    ? 0
    : Math.round(subtotalCents * (grtPercent / 100));
  const totalCents = subtotalCents + taxCents;
  return {
    subtotalCents,
    taxCents,
    totalCents,
    weightSubtotalCents,
    bulkySubtotalCents,
  };
}

/**
 * Given stored totalCents (subtotal + tax), split back into subtotal and tax for receipt display.
 * When nmgrtExempt, totalCents is subtotal only (taxCents = 0).
 */
export function computeSubtotalAndTaxCents(
  totalCents: number,
  grtPercent: number,
  nmgrtExempt = false
): { subtotalCents: number; taxCents: number } {
  if (nmgrtExempt) {
    return { subtotalCents: totalCents, taxCents: 0 };
  }
  const subtotalCents = Math.round(totalCents / (1 + grtPercent / 100));
  const taxCents = totalCents - subtotalCents;
  return { subtotalCents, taxCents };
}
