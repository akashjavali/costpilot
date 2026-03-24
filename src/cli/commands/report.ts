import { getAllUsage, getTotalCostByTimeRange } from "../../storage/queries.js";
import {
  formatUSD, formatDate, formatDuration,
  printTable, printSectionHeader
} from "../display.js";

export function runReport(options: { hours?: number } = {}): void {
  const hours = options.hours ?? 24;
  const fromMs = Date.now() - hours * 3_600_000;
  const toMs = Date.now();

  const records = getAllUsage(500);
  const recentRecords = records.filter((r) => r.timestamp >= fromMs);
  const totalCost = getTotalCostByTimeRange(fromMs, toMs);

  printSectionHeader(`CostPilot Report — Last ${hours}h`);

  if (recentRecords.length === 0) {
    console.log("\nNo usage recorded yet. Wrap your AI client with withCostPilot() to start tracking.\n");
    return;
  }

  console.log(`\nTotal: ${formatUSD(totalCost)}  |  Calls: ${recentRecords.length}\n`);

  printTable(
    ["Time", "Model", "Input", "Output", "Cost", "Duration"],
    recentRecords.slice(0, 20).map((r) => [
      formatDate(r.timestamp),
      r.model,
      r.inputTokens.toLocaleString(),
      r.outputTokens.toLocaleString(),
      formatUSD(r.costUsd),
      formatDuration(r.durationMs),
    ])
  );

  if (recentRecords.length > 20) {
    console.log(`\n  ... and ${recentRecords.length - 20} more calls\n`);
  }
}
