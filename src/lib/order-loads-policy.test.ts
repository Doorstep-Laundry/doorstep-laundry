import { describe, expect, it } from "vitest";
import {
  canAddOrderLoad,
  canDeleteLastOrderLoad,
  initialLoadStatusForOrder,
} from "./order-loads-policy";

describe("canAddOrderLoad", () => {
  it("allows pre-delivery operational statuses", () => {
    expect(canAddOrderLoad("scheduled")).toBe(true);
    expect(canAddOrderLoad("picked_up")).toBe(true);
    expect(canAddOrderLoad("ready_for_wash")).toBe(true);
    expect(canAddOrderLoad("in_progress")).toBe(true);
  });

  it("blocks cancelled and post-payment / delivery statuses", () => {
    expect(canAddOrderLoad("cancelled")).toBe(false);
    expect(canAddOrderLoad("ready_for_delivery")).toBe(false);
    expect(canAddOrderLoad("out_for_delivery")).toBe(false);
    expect(canAddOrderLoad("delivered")).toBe(false);
  });
});

describe("canDeleteLastOrderLoad (driver remove; washer has no UI)", () => {
  it("allows scheduled with more than one load and scheduled last", () => {
    expect(
      canDeleteLastOrderLoad("scheduled", 2, "scheduled")
    ).toEqual({ ok: true });
  });

  it("allows picked_up with picked_up last load", () => {
    expect(canDeleteLastOrderLoad("picked_up", 2, "picked_up")).toEqual({ ok: true });
  });

  it("rejects when fewer than 2 loads", () => {
    const r = canDeleteLastOrderLoad("scheduled", 1, "scheduled");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/at least one load/);
  });

  it("rejects when order is past pickup (washer cannot remove via API)", () => {
    const r = canDeleteLastOrderLoad("ready_for_wash", 2, "ready_for_wash");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/scheduled or picked up/);
  });

  it("rejects when last load has started processing past incoming", () => {
    const r = canDeleteLastOrderLoad("picked_up", 2, "washing");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/not started processing/);
  });
});

describe("initialLoadStatusForOrder", () => {
  it("maps order status to new load status", () => {
    expect(initialLoadStatusForOrder("scheduled")).toBe("scheduled");
    expect(initialLoadStatusForOrder("picked_up")).toBe("picked_up");
    expect(initialLoadStatusForOrder("ready_for_wash")).toBe("ready_for_wash");
    expect(initialLoadStatusForOrder("in_progress")).toBe("ready_for_wash");
  });
});
