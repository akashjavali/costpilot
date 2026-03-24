import type { InsightResult } from "../core/types.js";
import { getHourlyCosts, getTopModelsByTotalCost } from "../storage/queries.js";
import { getDb } from "../storage/db.js";

const SPIKE_THRESHOLD = 2.0;

export function detectSpikes(windowHours = 24): InsightResult[] {
  const hourlyCosts = getHourlyCosts(windowHours * 2);
  if (hourlyCosts.length < 2) return [];

  const midpoint = Math.floor(hourlyCosts.length / 2);
  const previous = hourlyCosts.slice(0, midpoint);
  const current = hourlyCosts.slice(midpoint);

  const prevTotal = previous.reduce((s, h) => s + h.totalCost, 0);
  const currTotal = current.reduce((s, h) => s + h.totalCost, 0);

  if (prevTotal === 0 || currTotal === 0) return [];

  const ratio = currTotal / prevTotal;
  if (ratio < SPIKE_THRESHOLD) return [];

  const severity = ratio >= 3 ? "critical" : "warning";
  return [
    {
      type: "spike",
      severity,
      message: `Cost increased ${ratio.toFixed(1)}x in last ${windowHours}h vs previous ${windowHours}h`,
      data: { ratio, prevTotal, currTotal, windowHours },
    },
  ];
}

export function getTopModelInsights(dominanceThreshold = 0.6): InsightResult[] {
  const top = getTopModelsByTotalCost(10);
  if (top.length === 0) return [];

  const grandTotal = top.reduce((s, m) => s + m.totalCost, 0);
  if (grandTotal === 0) return [];

  const insights: InsightResult[] = [];
  for (const entry of top) {
    const pct = entry.totalCost / grandTotal;
    if (pct >= dominanceThreshold) {
      insights.push({
        type: "top_model",
        severity: "info",
        message: `${(pct * 100).toFixed(0)}% of cost from ${entry.model} — consider a cheaper model`,
        data: { model: entry.model, pct, totalCost: entry.totalCost },
      });
    }
  }
  return insights;
}

export function getSummary(): {
  totalCostUsd: number;
  totalCalls: number;
  totalTokens: number;
  avgCostPerCall: number;
} {
  // Use SQL aggregation — never load all rows into memory
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(cost_usd), 0)    AS totalCostUsd,
      COUNT(*)                       AS totalCalls,
      COALESCE(SUM(total_tokens), 0) AS totalTokens
    FROM usage
  `).get() as { totalCostUsd: number; totalCalls: number; totalTokens: number };

  return {
    ...row,
    avgCostPerCall: row.totalCalls > 0 ? row.totalCostUsd / row.totalCalls : 0,
  };
}

export function getAllInsights(): InsightResult[] {
  return [...detectSpikes(), ...getTopModelInsights()];
}
