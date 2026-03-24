import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDb, closeDb } from "../../src/storage/db";
import {
  insertUsage,
  getAllUsage,
  getUsageByTimeRange,
  getTopModelsByTotalCost,
} from "../../src/storage/queries";
import type { UsageRecord } from "../../src/core/types";

function makeRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    timestamp: Date.now(),
    provider: "openai",
    model: "gpt-4o",
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    costUsd: 0.00075,
    durationMs: 320,
    endpoint: "chat.completions.create",
    ...overrides,
  };
}

describe("Storage queries", () => {
  beforeEach(() => {
    initDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("inserts and retrieves a usage record", () => {
    const record = makeRecord();
    insertUsage(record);
    const rows = getAllUsage();
    expect(rows).toHaveLength(1);
    expect(rows[0].model).toBe("gpt-4o");
    expect(rows[0].costUsd).toBeCloseTo(0.00075);
  });

  it("filters by time range", () => {
    const now = Date.now();
    insertUsage(makeRecord({ timestamp: now - 10_000 }));
    insertUsage(makeRecord({ timestamp: now - 5_000 }));
    insertUsage(makeRecord({ timestamp: now + 5_000 }));
    const rows = getUsageByTimeRange(now - 7_000, now);
    expect(rows).toHaveLength(1);
  });

  it("returns top models by total cost", () => {
    insertUsage(makeRecord({ model: "gpt-4o",      costUsd: 1.0 }));
    insertUsage(makeRecord({ model: "gpt-4o",      costUsd: 2.0 }));
    insertUsage(makeRecord({ model: "gpt-4o-mini", costUsd: 0.1 }));
    const top = getTopModelsByTotalCost(5);
    expect(top[0].model).toBe("gpt-4o");
    expect(top[0].totalCost).toBeCloseTo(3.0);
    expect(top[1].model).toBe("gpt-4o-mini");
  });

  it("returns empty array when no records", () => {
    expect(getAllUsage()).toHaveLength(0);
  });
});
