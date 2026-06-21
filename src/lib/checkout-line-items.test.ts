import { describe, it, expect } from "vitest";
import {
  computeLoadCostCents,
  pickCreditedLoadIndices,
  buildStripeLineItemsWithCredits,
  buildWashAndBulkyStripeLineItems,
} from "./checkout-line-items";

const order = {
  orderNumber: "20260613-001",
  pickupDate: new Date("2026-06-14"),
  deliveryDate: new Date("2026-06-16"),
};

const PRICE = 150; // $1.50/lb
const PREMIUM = 200; // $2.00/lb same-day surcharge

describe("computeLoadCostCents", () => {
  it("returns weight × price when no bulky items", () => {
    expect(computeLoadCostCents({ weightLbs: 10 }, PRICE)).toBe(1500);
  });

  it("handles null / undefined weight as 0", () => {
    expect(computeLoadCostCents({ weightLbs: null }, PRICE)).toBe(0);
    expect(computeLoadCostCents({}, PRICE)).toBe(0);
  });

  it("adds bulky item cost", () => {
    // comforter: unitCents = round(150 × 20 / 1) = 3000
    const cost = computeLoadCostCents({ weightLbs: 0, bulkyItems: { comforter: 1 } }, PRICE);
    expect(cost).toBe(3000);
  });

  it("combines weight and bulky items", () => {
    // 5 lbs × 150 = 750, plus 1 comforter = 3000 → 3750
    const cost = computeLoadCostCents({ weightLbs: 5, bulkyItems: { comforter: 1 } }, PRICE);
    expect(cost).toBe(3750);
  });

  it("includes premium in weight cost but not bulky", () => {
    // weight: 10 lbs × (150 + 200) = 3500; bulky: comforter = round(150 × 20) = 3000 → 6500
    const cost = computeLoadCostCents({ weightLbs: 10, bulkyItems: { comforter: 1 } }, PRICE, PREMIUM);
    expect(cost).toBe(6500);
  });
});

describe("pickCreditedLoadIndices", () => {
  const loads = [
    { weightLbs: 5 },   // index 0, cost 750
    { weightLbs: 10 },  // index 1, cost 1500 — most expensive
    { weightLbs: 3 },   // index 2, cost 450
  ];

  it("returns empty set when creditedCount is 0", () => {
    expect(pickCreditedLoadIndices(loads, 0, PRICE).size).toBe(0);
  });

  it("picks the most expensive load when N=1", () => {
    const indices = pickCreditedLoadIndices(loads, 1, PRICE);
    expect(indices.has(1)).toBe(true);
    expect(indices.size).toBe(1);
  });

  it("picks the two most expensive loads when N=2", () => {
    const indices = pickCreditedLoadIndices(loads, 2, PRICE);
    expect(indices.has(1)).toBe(true); // 10 lbs
    expect(indices.has(0)).toBe(true); // 5 lbs
    expect(indices.has(2)).toBe(false);
  });

  it("picks all loads when N equals total", () => {
    const indices = pickCreditedLoadIndices(loads, 3, PRICE);
    expect(indices.size).toBe(3);
  });

  it("handles loads with same cost deterministically", () => {
    const tied = [{ weightLbs: 5 }, { weightLbs: 5 }, { weightLbs: 5 }];
    const indices = pickCreditedLoadIndices(tied, 2, PRICE);
    expect(indices.size).toBe(2);
  });
});

describe("buildWashAndBulkyStripeLineItems — no credits (unchanged behavior)", () => {
  it("returns single wash line item for weighted loads", () => {
    const items = buildWashAndBulkyStripeLineItems(
      order,
      [{ weightLbs: 10 }, { weightLbs: 5 }],
      PRICE
    );
    expect(items).toHaveLength(1);
    expect(items[0].price_data.unit_amount).toBe(2250); // 15 lbs × 150
    expect(items[0].quantity).toBe(1);
  });

  it("includes bulky item lines", () => {
    const items = buildWashAndBulkyStripeLineItems(
      order,
      [{ weightLbs: 5, bulkyItems: { comforter: 1 } }],
      PRICE
    );
    // wash line + comforter line
    expect(items).toHaveLength(2);
    expect(items[1].price_data.product_data.name).toBe("Comforter");
  });
});

describe("buildStripeLineItemsWithCredits", () => {
  it("non-credited loads are aggregated, credited load has full + $0 items", () => {
    const loads = [
      { weightLbs: 8, loadNumber: 1 },  // non-credited
      { weightLbs: 10, loadNumber: 2 }, // credited (heaviest)
    ];
    const creditedIndices = new Set([1]);
    const items = buildStripeLineItemsWithCredits(order, loads, PRICE, creditedIndices, 0);

    // Non-credited: 8 lbs × 150 = 1200
    const washItem = items.find((i) => i.price_data.product_data.name === "Wash and fold (by weight)");
    expect(washItem).toBeDefined();
    expect(washItem!.price_data.unit_amount).toBe(1200);

    // Credited full-price line: 10 lbs × 150 = 1500
    const creditFullItem = items.find((i) =>
      i.price_data.product_data.name.includes("Wash and fold (Load 2)")
    );
    expect(creditFullItem).toBeDefined();
    expect(creditFullItem!.price_data.unit_amount).toBe(1500);

    // Credited discount line cancels the base
    const creditDiscountItem = items.find((i) =>
      i.price_data.product_data.name.includes("Free load credit (Load 2)")
    );
    expect(creditDiscountItem).toBeDefined();
    expect(creditDiscountItem!.quantity).toBe(-1);
  });

  it("includes tax item when taxCents > 0", () => {
    const loads = [{ weightLbs: 5, loadNumber: 1 }];
    const items = buildStripeLineItemsWithCredits(order, loads, PRICE, new Set(), 100);
    const taxItem = items.find((i) => i.price_data.product_data.name.includes("NMGRT"));
    expect(taxItem).toBeDefined();
    expect(taxItem!.price_data.unit_amount).toBe(100);
  });

  it("all loads credited returns only credited items and no wash aggregate", () => {
    const loads = [{ weightLbs: 5, loadNumber: 1 }];
    const items = buildStripeLineItemsWithCredits(order, loads, PRICE, new Set([0]), 0);
    const washAgg = items.find((i) => i.price_data.product_data.name === "Wash and fold (by weight)");
    expect(washAgg).toBeUndefined();
    const creditFull = items.find((i) =>
      i.price_data.product_data.name.includes("Wash and fold (Load 1)")
    );
    expect(creditFull).toBeDefined();
  });

  it("credit covers base rate only — premium surcharge still charged on credited load", () => {
    // Load 1: 10 lbs, credited. Base: 10×150=1500 (free). Premium: 10×200=2000 (still charged).
    const loads = [{ weightLbs: 10, loadNumber: 1 }];
    const items = buildStripeLineItemsWithCredits(order, loads, PRICE, new Set([0]), 0, PREMIUM);

    // Base wash line for credited load
    const baseWash = items.find((i) => i.price_data.product_data.name.includes("Wash and fold (Load 1)"));
    expect(baseWash).toBeDefined();
    expect(baseWash!.price_data.unit_amount).toBe(1500); // base rate only

    // Discount cancels exactly the base
    const discount = items.find((i) => i.price_data.product_data.name.includes("Free load credit (Load 1)"));
    expect(discount).toBeDefined();
    expect(discount!.price_data.unit_amount).toBe(1500);
    expect(discount!.quantity).toBe(-1);

    // Premium surcharge line is present and NOT cancelled
    const surcharge = items.find((i) => i.price_data.product_data.name.includes("Expedited service surcharge (Load 1)"));
    expect(surcharge).toBeDefined();
    expect(surcharge!.price_data.unit_amount).toBe(2000); // 10 lbs × $2.00/lb
    expect(surcharge!.quantity).toBe(1); // positive — still charged

    // No aggregate wash line (all loads credited)
    const washAgg = items.find((i) => i.price_data.product_data.name === "Wash and fold (by weight)");
    expect(washAgg).toBeUndefined();
  });

  it("non-credited loads use effective rate (base + premium) in aggregate line", () => {
    // Load 1: 8 lbs non-credited. Load 2: 10 lbs credited.
    const loads = [
      { weightLbs: 8, loadNumber: 1 },
      { weightLbs: 10, loadNumber: 2 },
    ];
    const items = buildStripeLineItemsWithCredits(order, loads, PRICE, new Set([1]), 0, PREMIUM);

    // Non-credited wash aggregate: 8 lbs × (150+200) = 2800
    const washItem = items.find((i) => i.price_data.product_data.name === "Wash and fold (by weight)");
    expect(washItem).toBeDefined();
    expect(washItem!.price_data.unit_amount).toBe(2800);

    // Credited base: 10×150=1500 (shown + cancelled)
    const creditBase = items.find((i) => i.price_data.product_data.name.includes("Wash and fold (Load 2)"));
    expect(creditBase!.price_data.unit_amount).toBe(1500);

    // Credited premium: 10×200=2000 (charged)
    const creditPremium = items.find((i) => i.price_data.product_data.name.includes("Expedited service surcharge (Load 2)"));
    expect(creditPremium!.price_data.unit_amount).toBe(2000);
  });

  it("no premium surcharge line when premium is 0", () => {
    const loads = [{ weightLbs: 10, loadNumber: 1 }];
    const items = buildStripeLineItemsWithCredits(order, loads, PRICE, new Set([0]), 0, 0);
    const surcharge = items.find((i) => i.price_data.product_data.name.includes("Expedited service surcharge"));
    expect(surcharge).toBeUndefined();
  });
});
