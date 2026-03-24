import { getAllInsights, getSummary } from "../../insights/engine.js";
import { formatUSD, printInsight, printSectionHeader } from "../display.js";

export function runAnomalies(): void {
  printSectionHeader("CostPilot Insights & Anomalies");

  const summary = getSummary();
  console.log(`\nTotal tracked: ${formatUSD(summary.totalCostUsd)} across ${summary.totalCalls} calls`);
  console.log(`Avg per call:  ${formatUSD(summary.avgCostPerCall)}\n`);

  const insights = getAllInsights();

  if (insights.length === 0) {
    console.log("✅ No anomalies detected. Usage looks normal.\n");
    return;
  }

  for (const insight of insights) {
    printInsight(insight.severity, insight.message);
  }
  console.log();
}
