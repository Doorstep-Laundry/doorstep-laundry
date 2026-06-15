import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrderStatus } from "@prisma/client";

// Mock Prisma
vi.mock("./db", () => ({
  prisma: {
    order: {
      findMany: vi.fn(),
    },
  },
}));

// Mock settings
vi.mock("./settings", () => ({
  getPastDueGracePeriodDays: vi.fn(),
}));

import { prisma } from "./db";
import { getPastDueGracePeriodDays } from "./settings";
import { getPastDueOrders } from "./past-due";

const mockFindMany = prisma.order.findMany as ReturnType<typeof vi.fn>;
const mockGracePeriod = getPastDueGracePeriodDays as ReturnType<typeof vi.fn>;

describe("getPastDueOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGracePeriod.mockResolvedValue(3);
    mockFindMany.mockResolvedValue([]);
  });

  it("queries with the correct past-due statuses", async () => {
    await getPastDueOrders("customer-1");

    expect(mockFindMany).toHaveBeenCalledOnce();
    const where = mockFindMany.mock.calls[0][0].where;
    expect(where.customerId).toBe("customer-1");
    expect(where.stripePaymentId).toBeNull();
    expect(where.status.in).toEqual(
      expect.arrayContaining([
        OrderStatus.ready_for_delivery,
        OrderStatus.out_for_delivery,
        OrderStatus.delivered,
      ])
    );
  });

  it("sets the cutoff date using the configured grace period", async () => {
    mockGracePeriod.mockResolvedValue(5);
    await getPastDueOrders("customer-1");

    const where = mockFindMany.mock.calls[0][0].where;
    const cutoff: Date = where.deliveryDate.lt;
    const expected = new Date();
    expected.setDate(expected.getDate() - 5);

    // compare date portion only (code sets time to end-of-day)
    expect(cutoff.getFullYear()).toBe(expected.getFullYear());
    expect(cutoff.getMonth()).toBe(expected.getMonth());
    expect(cutoff.getDate()).toBe(expected.getDate());
    // cutoff is end-of-day on that date
    expect(cutoff.getHours()).toBe(23);
    expect(cutoff.getMinutes()).toBe(59);
  });

  it("returns past-due orders from the query", async () => {
    const fakePastDue = [
      { id: "ord-1", orderNumber: "ORD-001", totalCents: 2500, deliveryDate: new Date("2025-01-01") },
      { id: "ord-2", orderNumber: "ORD-002", totalCents: 1800, deliveryDate: new Date("2025-01-05") },
    ];
    mockFindMany.mockResolvedValue(fakePastDue);

    const result = await getPastDueOrders("customer-1");
    expect(result).toEqual(fakePastDue);
  });

  it("returns empty array when customer has no past-due orders", async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await getPastDueOrders("customer-1");
    expect(result).toEqual([]);
  });

  it("uses grace period of 0 days (no grace)", async () => {
    mockGracePeriod.mockResolvedValue(0);
    await getPastDueOrders("customer-1");

    const where = mockFindMany.mock.calls[0][0].where;
    const cutoff: Date = where.deliveryDate.lt;
    const now = new Date();
    // With 0-day grace, cutoff should be around end-of-today
    const diffMs = Math.abs(cutoff.getTime() - now.getTime());
    expect(diffMs).toBeLessThan(86400000); // within one day
  });
});
