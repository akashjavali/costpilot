import { getTopModelsByTotalCost } from "../../storage/queries.js";
import { formatUSD, printTable, printSectionHeader } from "../display.js";

export function runTop(options: { limit?: number } = {}): void {
  const limit = options.limit ?? 10;
  const top = getTopModelsByTotalCost(limit);

  printSectionHeader("Top Models by Cost");

  if (top.length === 0) {
    console.log("\nNo usage data yet.\n");
    return;
  }

  const grandTotal = top.reduce((s, m) => s + m.totalCost, 0);

  printTable(
    ["Model", "Total Cost", "Calls", "Avg/Call", "Share"],
    top.map((m) => [
      m.model,
      formatUSD(m.totalCost),
      m.callCount.toString(),
      formatUSD(m.totalCost / m.callCount),
      `${((m.totalCost / grandTotal) * 100).toFixed(1)}%`,
    ])
  );

  console.log(`\n  Grand total: ${formatUSD(grandTotal)}\n`);
}
