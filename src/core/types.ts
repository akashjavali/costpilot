export interface UsageRecord {
  id?: number;
  timestamp: number;          // Unix ms
  provider: string;           // "openai" | "anthropic" | "gemini"
  model: string;              // e.g. "gpt-4o"
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
  endpoint?: string;          // e.g. "chat.completions.create"
  metadata?: Record<string, unknown>;
}

export interface ModelPricing {
  inputCostPer1M: number;     // USD per 1M input tokens
  outputCostPer1M: number;    // USD per 1M output tokens
}

export interface CostPilotConfig {
  provider: "openai" | "anthropic" | "gemini";
  dbPath?: string;            // defaults to ~/.costpilot/usage.db
  silent?: boolean;           // suppress console warnings
}

export interface InsightResult {
  type: "spike" | "top_model" | "expensive_endpoint";
  severity: "info" | "warning" | "critical";
  message: string;
  data?: Record<string, unknown>;
}
