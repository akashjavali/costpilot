import { Command } from "commander";
import { initDb } from "../storage/db.js";
import { runReport } from "./commands/report.js";
import { runTop } from "./commands/top.js";
import { runAnomalies } from "./commands/anomalies.js";

initDb();

const program = new Command();

program
  .name("costpilot")
  .description("Track and analyze your AI API costs")
  .version("0.1.0");

program
  .command("report")
  .description("Show usage report for the last N hours")
  .option("-h, --hours <n>", "Hours to look back", "24")
  .action((opts) => {
    runReport({ hours: parseInt(opts.hours, 10) });
  });

program
  .command("top")
  .description("Show top models by total cost")
  .option("-n, --limit <n>", "Number of models to show", "10")
  .action((opts) => {
    runTop({ limit: parseInt(opts.limit, 10) });
  });

program
  .command("anomalies")
  .description("Detect cost spikes and surface optimization insights")
  .action(() => {
    runAnomalies();
  });

program.parse(process.argv);
