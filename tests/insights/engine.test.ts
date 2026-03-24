import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectSpikes, getTopModelInsights, getSummary } from "../../src/insights/engine";
import { initDb, closeDb } from "../../src/storage/db";
import { insertUsage } from "../../src/storage/queries";
import type { UsageRecord } from "../../src/core/types";

function makeRecord(costUsd: number, timestamp: number, model = "gpt-4o"): UsageRecord {
  return {
    timestamp,
    provider: "openai",
    model,
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    costUsd,
    durationMs: 300,
  };
}

describe("Insights Engine", () => {
  beforeEach(() => initDb(":memory:"));
  afterEach(() => closeDb());

  describe("detectSpikes", () => {
    it("detects a 3x cost spike vs previous window", () => {
      const HOUR = 3_600_000;
      // Use a fixed base time aligned to an hour boundary to guarantee distinct hour buckets
      const base = Math.floor(Date.now() / HOUR) * HOUR;

      // Previous 24h window: 24 records, each in its own hour slot, $0.10 each = $2.40 total
      for (let i = 48; i > 24; i--) {
        insertUsage(makeRecord(0.10, base - i * HOUR + 1)); // +1ms to stay in that bucket
      }
      // Current 24h window: 24 records at $0.33 each = $7.92 (~3.3x)
      for (let i = 24; i > 0; i--) {
        insertUsage(makeRecord(0.33, base - i * HOUR + 1));
      }

      const spikes = detectSpikes();
      expect(spikes.length).toBeGreaterThan(0);
      expect(spikes[0].severity).toMatch(/warning|critical/);
      expect(spikes[0].message).toMatch(/\d+(\.\d+)?x/);
    });

    it("returns empty array when cost is stable", () => {
      const HOUR = 3_600_000;
      const base = Math.floor(Date.now() / HOUR) * HOUR;
      for (let i = 48; i > 0; i--) {
        insertUsage(makeRecord(0.10, base - i * HOUR + 1));
      }
      expect(detectSpikes()).toHaveLength(0);
    });
  });

  describe("getTopModelInsights", () => {
    it("flags model that dominates cost", () => {
      const now = Date.now();
      insertUsage(makeRecord(9.0, now, "gpt-4o"));
      insertUsage(makeRecord(0.5, now, "gpt-4o-mini"));
      insertUsage(makeRecord(0.5, now, "gpt-3.5-turbo"));

      const insights = getTopModelInsights();
      expect(insights.some((i) => i.message.includes("gpt-4o"))).toBe(true);
    });
  });

  describe("getSummary", () => {
    it("returns total cost and call count", () => {
      const now = Date.now();
      insertUsage(makeRecord(1.0, now));
      insertUsage(makeRecord(2.0, now));
      const summary = getSummary();
      expect(summary.totalCostUsd).toBeCloseTo(3.0);
      expect(summary.totalCalls).toBe(2);
    });
  });
});
