import { wrapOpenAI } from "../providers/openai.js";
import type { CostPilotConfig } from "./types.js";
import { initDb } from "../storage/db.js";

let initialized = false;

export function initCostPilot(config: Partial<CostPilotConfig> = {}): void {
  if (initialized) return;
  initialized = true;
  initDb(config.dbPath);
}

export function withCostPilot<T extends object>(
  client: T,
  config?: Partial<CostPilotConfig>
): T {
  if (!initialized) {
    initDb(config?.dbPath);
    initialized = true;
  }

  // Detect provider by client shape (has chat.completions → OpenAI)
  if ("chat" in client) {
    return wrapOpenAI(client);
  }

  // Passthrough for unrecognized clients (fail gracefully)
  return client;
}
