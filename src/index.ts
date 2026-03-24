// Main SDK
export { withCostPilot, initCostPilot } from "./core/tracker.js";

// Types
export type { UsageRecord, ModelPricing, CostPilotConfig, InsightResult } from "./core/types.js";

// Cost engine
export { calculateCost, getPricing } from "./cost/engine.js";
export { PRICING } from "./cost/pricing.js";

// Storage
export { initDb, getDb, closeDb } from "./storage/db.js";
export {
  insertUsage, getAllUsage, getUsageByTimeRange,
  getTopModelsByTotalCost, getTotalCostByTimeRange,
} from "./storage/queries.js";

// Insights
export { detectSpikes, getTopModelInsights, getSummary, getAllInsights } from "./insights/engine.js";
