import { describe, it, expect } from "vitest";
import { displayOrderNumber, tagQrPayload, tagPrintLines } from "./load-tag";

describe("displayOrderNumber", () => {
  it("strips ORDER- prefix", () => {
    expect(displayOrderNumber("ORDER-20260702-0001")).toBe("20260702-0001");
  });

  it("returns string unchanged when no prefix", () => {
    expect(displayOrderNumber("20260702-0001")).toBe("20260702-0001");
  });

  it("strips only the leading ORDER- prefix, not mid-string occurrences", () => {
    expect(displayOrderNumber("ORDER-ORDER-0001")).toBe("ORDER-0001");
  });
});

describe("tagQrPayload", () => {
  it("produces pipe-delimited string", () => {
    expect(tagQrPayload("ORDER-20260702-0001", 1, 3)).toBe("ORDER-20260702-0001|1|3");
  });

  it("includes all three fields", () => {
    const payload = tagQrPayload("ORDER-20260101-0042", 2, 5);
    const parts = payload.split("|");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("ORDER-20260101-0042");
    expect(parts[1]).toBe("2");
    expect(parts[2]).toBe("5");
  });
});

describe("tagPrintLines", () => {
  it("splits standard YYYYMMDD- format correctly", () => {
    const { line1, line2 } = tagPrintLines("ORDER-20260702-0001", 1, 3);
    expect(line1).toBe("20260702-");
    expect(line2).toBe("0001 L1 / 3");
  });

  it("reflects loadNumber and numberOfLoads in line2", () => {
    const { line2 } = tagPrintLines("ORDER-20260702-0042", 2, 4);
    expect(line2).toBe("0042 L2 / 4");
  });

  it("falls back gracefully when order number has no YYYYMMDD- prefix", () => {
    const { line1, line2 } = tagPrintLines("CUSTOM-ORDER", 1, 1);
    expect(line1).toBe("CUSTOM-ORDER");
    expect(line2).toBe("L1 / 1");
  });

  it("handles single-load orders", () => {
    const { line2 } = tagPrintLines("ORDER-20260702-0001", 1, 1);
    expect(line2).toBe("0001 L1 / 1");
  });
});
