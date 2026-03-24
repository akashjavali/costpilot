import { getDb } from "./db.js";
import type { UsageRecord } from "../core/types.js";

interface DbRow {
  id: number;
  timestamp: number;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  duration_ms: number;
  endpoint: string | null;
  metadata: string | null;
}

function rowToRecord(row: DbRow): UsageRecord {
  return {
    id: row.id,
    timestamp: row.timestamp,
    provider: row.provider,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    costUsd: row.cost_usd,
    durationMs: row.duration_ms,
    endpoint: row.endpoint ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

export function insertUsage(record: UsageRecord): void {
  const db = getDb();
  // Explicit params — do NOT spread record (it may include `id` which is not a named param here)
  db.prepare(`
    INSERT INTO usage
      (timestamp, provider, model, input_tokens, output_tokens, total_tokens, cost_usd, duration_ms, endpoint, metadata)
    VALUES
      (@timestamp, @provider, @model, @inputTokens, @outputTokens, @totalTokens, @costUsd, @durationMs, @endpoint, @metadata)
  `).run({
    timestamp:    record.timestamp,
    provider:     record.provider,
    model:        record.model,
    inputTokens:  record.inputTokens,
    outputTokens: record.outputTokens,
    totalTokens:  record.totalTokens,
    costUsd:      record.costUsd,
    durationMs:   record.durationMs,
    endpoint:     record.endpoint ?? null,
    metadata:     record.metadata ? JSON.stringify(record.metadata) : null,
  });
}

export function getAllUsage(limit = 1000): UsageRecord[] {
  const db = getDb();
  return (
    db.prepare("SELECT * FROM usage ORDER BY timestamp DESC LIMIT ?")
      .all(limit) as DbRow[]
  ).map(rowToRecord);
}

export function getUsageByTimeRange(fromMs: number, toMs: number): UsageRecord[] {
  const db = getDb();
  return (
    db.prepare("SELECT * FROM usage WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC")
      .all(fromMs, toMs) as DbRow[]
  ).map(rowToRecord);
}

export function getTopModelsByTotalCost(limit = 10): Array<{ model: string; totalCost: number; callCount: number }> {
  const db = getDb();
  return db.prepare(`
    SELECT model,
           SUM(cost_usd) AS totalCost,
           COUNT(*)      AS callCount
    FROM usage
    GROUP BY model
    ORDER BY totalCost DESC
    LIMIT ?
  `).all(limit) as Array<{ model: string; totalCost: number; callCount: number }>;
}

export function getTotalCostByTimeRange(fromMs: number, toMs: number): number {
  const db = getDb();
  const row = db.prepare(
    "SELECT COALESCE(SUM(cost_usd), 0) AS total FROM usage WHERE timestamp BETWEEN ? AND ?"
  ).get(fromMs, toMs) as { total: number };
  return row.total;
}

export function getHourlyCosts(hours = 48): Array<{ hour: number; totalCost: number }> {
  const db = getDb();
  return db.prepare(`
    SELECT (timestamp / 3600000) AS hour,
           SUM(cost_usd)         AS totalCost
    FROM usage
    WHERE timestamp > ?
    GROUP BY hour
    ORDER BY hour ASC
  `).all(Date.now() - hours * 3_600_000) as Array<{ hour: number; totalCost: number }>;
}
