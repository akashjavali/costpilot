import { describe, it, expect } from "vitest";
import { calculateCost, getPricing } from "../../src/cost/engine";

describe("calculateCost", () => {
  it("calculates gpt-4o cost correctly", () => {
    // gpt-4o: $2.50/1M input, $10.00/1M output
    const cost = calculateCost("gpt-4o", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(12.5, 4);
  });

  it("calculates gpt-4o-mini cost correctly", () => {
    // gpt-4o-mini: $0.15/1M input, $0.60/1M output
    const cost = calculateCost("gpt-4o-mini", 100_000, 50_000);
    expect(cost).toBeCloseTo(0.015 + 0.03, 6);
  });

  it("returns 0 for unknown model", () => {
    const cost = calculateCost("unknown-model-xyz", 1000, 1000);
    expect(cost).toBe(0);
  });

  it("handles zero tokens", () => {
    expect(calculateCost("gpt-4o", 0, 0)).toBe(0);
  });
});

describe("getPricing", () => {
  it("returns pricing for known model", () => {
    const pricing = getPricing("gpt-4o");
    expect(pricing).not.toBeNull();
    expect(pricing?.inputCostPer1M).toBe(2.5);
    expect(pricing?.outputCostPer1M).toBe(10.0);
  });

  it("returns null for unknown model", () => {
    expect(getPricing("nonexistent-model")).toBeNull();
  });
});
