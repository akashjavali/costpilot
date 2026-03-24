import type { ModelPricing } from "../core/types.js";

// Pricing per 1M tokens in USD
// Source: official provider pricing pages (update periodically)
export const PRICING: Record<string, ModelPricing> = {
  // OpenAI
  "gpt-4o":              { inputCostPer1M: 2.5,   outputCostPer1M: 10.0  },
  "gpt-4o-mini":         { inputCostPer1M: 0.15,  outputCostPer1M: 0.6   },
  "gpt-4-turbo":         { inputCostPer1M: 10.0,  outputCostPer1M: 30.0  },
  "gpt-4-turbo-preview": { inputCostPer1M: 10.0,  outputCostPer1M: 30.0  },
  "gpt-4":               { inputCostPer1M: 30.0,  outputCostPer1M: 60.0  },
  "gpt-3.5-turbo":       { inputCostPer1M: 0.5,   outputCostPer1M: 1.5   },
  "o1":                  { inputCostPer1M: 15.0,  outputCostPer1M: 60.0  },
  "o1-mini":             { inputCostPer1M: 3.0,   outputCostPer1M: 12.0  },
  "o3-mini":             { inputCostPer1M: 1.1,   outputCostPer1M: 4.4   },

  // Anthropic
  "claude-3-5-sonnet-20241022": { inputCostPer1M: 3.0,  outputCostPer1M: 15.0 },
  "claude-3-5-sonnet-latest":   { inputCostPer1M: 3.0,  outputCostPer1M: 15.0 },
  "claude-3-5-haiku-20241022":  { inputCostPer1M: 0.8,  outputCostPer1M: 4.0  },
  "claude-3-5-haiku-latest":    { inputCostPer1M: 0.8,  outputCostPer1M: 4.0  },
  "claude-3-opus-20240229":     { inputCostPer1M: 15.0, outputCostPer1M: 75.0 },
  "claude-3-sonnet-20240229":   { inputCostPer1M: 3.0,  outputCostPer1M: 15.0 },
  "claude-3-haiku-20240307":    { inputCostPer1M: 0.25, outputCostPer1M: 1.25 },

  // Google Gemini
  "gemini-1.5-pro":        { inputCostPer1M: 3.5,    outputCostPer1M: 10.5  },
  "gemini-1.5-flash":      { inputCostPer1M: 0.075,  outputCostPer1M: 0.3   },
  "gemini-1.5-flash-8b":   { inputCostPer1M: 0.0375, outputCostPer1M: 0.15  },
  "gemini-2.0-flash":      { inputCostPer1M: 0.1,    outputCostPer1M: 0.4   },
  "gemini-2.0-flash-lite": { inputCostPer1M: 0.075,  outputCostPer1M: 0.3   },
};
