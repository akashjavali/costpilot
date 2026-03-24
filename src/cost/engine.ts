import type { ModelPricing } from "../core/types.js";
import { PRICING } from "./pricing.js";

export function getPricing(model: string): ModelPricing | null {
  return PRICING[model] ?? null;
}

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getPricing(model);
  if (!pricing) return 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.inputCostPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputCostPer1M;
  return inputCost + outputCost;
}
