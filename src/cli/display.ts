import chalk from "chalk";
import Table from "cli-table3";

export function formatUSD(amount: number): string {
  if (amount < 0.001) return chalk.gray(`$${(amount * 1000).toFixed(3)}m`);
  if (amount < 1) return chalk.yellow(`$${amount.toFixed(4)}`);
  return chalk.red(`$${amount.toFixed(4)}`);
}

export function formatDate(timestampMs: number): string {
  return new Date(timestampMs).toLocaleString();
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function printTable(headers: string[], rows: string[][]): void {
  const table = new Table({
    head: headers.map((h) => chalk.cyan(h)),
    style: { head: [], border: [] },
  });
  rows.forEach((r) => table.push(r));
  console.log(table.toString());
}

export function printInsight(
  severity: "info" | "warning" | "critical",
  message: string
): void {
  const icon =
    severity === "critical" ? "🚨" :
    severity === "warning"  ? "⚠️ " : "💡";
  const color =
    severity === "critical" ? chalk.red :
    severity === "warning"  ? chalk.yellow :
    chalk.blue;
  console.log(`${icon} ${color(message)}`);
}

export function printSectionHeader(title: string): void {
  console.log("\n" + chalk.bold.white(title));
  console.log(chalk.gray("─".repeat(title.length)));
}
