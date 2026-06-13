import { describe, it, expect } from "vitest";
import {
  VALID_ORDER_TRANSITIONS,
  type OrderStatus,
  getOrderStatusFromLoads,
  type LoadRow,
} from "./order-transitions";

describe("order status transitions", () => {
  it("scheduled can go to picked_up or cancelled", () => {
    expect(VALID_ORDER_TRANSITIONS.scheduled).toContain("picked_up");
    expect(VALID_ORDER_TRANSITIONS.scheduled).toContain("cancelled");
  });

  it("picked_up can go to ready_for_wash, in_progress, or cancelled", () => {
    expect(VALID_ORDER_TRANSITIONS.picked_up).toContain("ready_for_wash");
    expect(VALID_ORDER_TRANSITIONS.picked_up).toContain("in_progress");
    expect(VALID_ORDER_TRANSITIONS.picked_up).toContain("cancelled");
  });

  it("ready_for_wash can go to in_progress or cancelled", () => {
    expect(VALID_ORDER_TRANSITIONS.ready_for_wash).toContain("in_progress");
    expect(VALID_ORDER_TRANSITIONS.ready_for_wash).toContain("cancelled");
  });

  it("in_progress can go to ready_for_delivery, out_for_delivery, or cancelled", () => {
    expect(VALID_ORDER_TRANSITIONS.in_progress).toContain("ready_for_delivery");
    expect(VALID_ORDER_TRANSITIONS.in_progress).toContain("out_for_delivery");
    expect(VALID_ORDER_TRANSITIONS.in_progress).toContain("cancelled");
  });

  it("waiting_for_payment can go to ready_for_delivery or cancelled (delivery independent of payment)", () => {
    expect(VALID_ORDER_TRANSITIONS.waiting_for_payment).toContain("ready_for_delivery");
    expect(VALID_ORDER_TRANSITIONS.waiting_for_payment).toContain("cancelled");
    expect(VALID_ORDER_TRANSITIONS.waiting_for_payment).not.toContain("delivered");
  });

  it("ready_for_delivery can go to out_for_delivery or cancelled", () => {
    expect(VALID_ORDER_TRANSITIONS.ready_for_delivery).toContain("out_for_delivery");
    expect(VALID_ORDER_TRANSITIONS.ready_for_delivery).toContain("cancelled");
  });

  it("out_for_delivery can only go to delivered", () => {
    expect(VALID_ORDER_TRANSITIONS.out_for_delivery).toEqual(["delivered"]);
  });

  it("delivered and cancelled have no next status", () => {
    expect(VALID_ORDER_TRANSITIONS.delivered).toEqual([]);
    expect(VALID_ORDER_TRANSITIONS.cancelled).toEqual([]);
  });

  it("no draft in transitions", () => {
    const statuses = Object.keys(VALID_ORDER_TRANSITIONS) as OrderStatus[];
    expect(statuses).not.toContain("draft");
  });
});

describe("getOrderStatusFromLoads", () => {
  it("picked_up + all loads have location → ready_for_wash", () => {
    const loads: LoadRow[] = [
      { status: "ready_for_pickup", location: "A1", weightLbs: null },
      { status: "incoming", location: "A2", weightLbs: null },
    ];
    expect(getOrderStatusFromLoads("picked_up", loads)).toBe("ready_for_wash");
  });

  it("picked_up + some load missing location → null", () => {
    const loads: LoadRow[] = [
      { status: "ready_for_pickup", location: "A1", weightLbs: null },
      { status: "incoming", location: "", weightLbs: null },
    ];
    expect(getOrderStatusFromLoads("picked_up", loads)).toBeNull();
  });

  it("ready_for_wash + one load washing → in_progress", () => {
    const loads: LoadRow[] = [
      { status: "ready_for_wash", location: "A1" },
      { status: "washing", location: "A2" },
    ];
    expect(getOrderStatusFromLoads("ready_for_wash", loads)).toBe("in_progress");
  });

  it("in_progress + all loads in washing/drying/folding → in_progress", () => {
    const loads: LoadRow[] = [
      { status: "drying", location: "A1" },
      { status: "folding", location: "A2" },
    ];
    expect(getOrderStatusFromLoads("in_progress", loads)).toBe("in_progress");
  });

  it("in_progress + all loads cleaned with location and weight → waiting_for_payment", () => {
    const loads: LoadRow[] = [
      { status: "cleaned", location: "A1", weightLbs: 10 },
      { status: "cleaned", location: "A2", weightLbs: 15 },
    ];
    expect(getOrderStatusFromLoads("in_progress", loads)).toBe("waiting_for_payment");
  });

  it("in_progress + all cleaned but one missing weight → null (no change to waiting_for_payment)", () => {
    const loads: LoadRow[] = [
      { status: "cleaned", location: "A1", weightLbs: 10 },
      { status: "cleaned", location: "A2", weightLbs: null },
    ];
    expect(getOrderStatusFromLoads("in_progress", loads)).toBeNull();
  });

  it("in_progress + all loads cleaned with weight → waiting_for_payment", () => {
    const loads: LoadRow[] = [
      { status: "cleaned", location: "A1", weightLbs: 10 },
      { status: "cleaned", location: "A2", weightLbs: 15 },
    ];
    expect(getOrderStatusFromLoads("in_progress", loads)).toBe("waiting_for_payment");
  });

  it("in_progress + all loads ready_for_delivery with weight → ready_for_delivery (loads only set on payment)", () => {
    const loads: LoadRow[] = [
      { status: "ready_for_delivery", location: "A1", weightLbs: 10 },
      { status: "ready_for_delivery", location: "A2", weightLbs: 15 },
    ];
    expect(getOrderStatusFromLoads("in_progress", loads)).toBe("ready_for_delivery");
  });

  it("in_progress + all loads ready_for_delivery without weight → ready_for_delivery", () => {
    const loads: LoadRow[] = [
      { status: "ready_for_delivery", location: "A1" },
      { status: "ready_for_delivery", location: "A2" },
    ];
    expect(getOrderStatusFromLoads("in_progress", loads)).toBe("ready_for_delivery");
  });

  it("ready_for_wash + all loads cleaned with weight → waiting_for_payment", () => {
    const loads: LoadRow[] = [
      { status: "cleaned", location: null, weightLbs: 12 },
    ];
    expect(getOrderStatusFromLoads("ready_for_wash", loads)).toBe("waiting_for_payment");
  });

  it("empty loads → null", () => {
    expect(getOrderStatusFromLoads("in_progress", [])).toBeNull();
  });

  it("order already delivered → null", () => {
    const loads: LoadRow[] = [{ status: "delivered", location: "A1" }];
    expect(getOrderStatusFromLoads("delivered", loads)).toBeNull();
  });
});
