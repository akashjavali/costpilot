# CostPilot

Track, analyze, and optimize your AI API costs — locally, with zero config.

All usage is stored in SQLite at `~/.costpilot/usage.db`. No cloud, no account, no telemetry.

## Install

```bash
npm install costpilot
```

## Quick Start

Wrap your existing OpenAI client with one line. Everything else stays the same.

```ts
import OpenAI from "openai";
import { withCostPilot } from "costpilot";

const openai = withCostPilot(new OpenAI());

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
// Cost is logged automatically — no other changes needed
```

## CLI

Install globally to use the CLI from anywhere:

```bash
npm install -g costpilot
```

Or use `npx`:

```bash
npx costpilot report
```

### Commands

#### `costpilot report`

Show a usage report for the last N hours (default: 24h).

```bash
costpilot report           # last 24h
costpilot report -h 72     # last 72h
```

Output:
```
CostPilot Report — Last 24h
───────────────────────────

Total: $0.0530  |  Calls: 47

┌────────────────────────┬────────────────┬───────┬────────┬─────────┬──────────┐
│ Time                   │ Model          │ Input │ Output │ Cost    │ Duration │
├────────────────────────┼────────────────┼───────┼────────┼─────────┼──────────┤
│ 24/03/2026, 6:18:35 pm │ gpt-4o         │ 314   │ 64     │ $0.0014 │ 430ms    │
│ 24/03/2026, 6:18:23 pm │ gpt-4o-mini    │ 54    │ 136    │ $0.090m │ 210ms    │
└────────────────────────┴────────────────┴───────┴────────┴─────────┴──────────┘
```

#### `costpilot top`

Show your most expensive models ranked by total cost.

```bash
costpilot top              # top 10
costpilot top -n 5         # top 5
```

Output:
```
Top Models by Cost
──────────────────
┌─────────────┬────────────┬───────┬──────────┬────────┐
│ Model       │ Total Cost │ Calls │ Avg/Call │ Share  │
├─────────────┼────────────┼───────┼──────────┼────────┤
│ gpt-4o      │ $0.0430    │ 32    │ $0.0013  │ 81.1%  │
│ gpt-4o-mini │ $0.0100    │ 15    │ $0.667m  │ 18.9%  │
└─────────────┴────────────┴───────┴──────────┴────────┘
  Grand total: $0.0530
```

#### `costpilot anomalies`

Detect cost spikes and surface optimization insights.

```bash
costpilot anomalies
```

Output:
```
CostPilot Insights & Anomalies
──────────────────────────────

Total tracked: $0.0530 across 47 calls
Avg per call:  $0.0011

🚨 Cost increased 17.2x in last 24h vs previous 24h
💡 81% of cost from gpt-4o — consider a cheaper model
```

## SDK API

### `withCostPilot(client, config?)`

Wraps an AI client and returns a transparent Proxy. All method calls pass through unchanged — costs are logged as a side effect.

```ts
import { withCostPilot } from "costpilot";

const client = withCostPilot(openai);
// or with options:
const client = withCostPilot(openai, { dbPath: "/custom/path/usage.db" });
```

### `initCostPilot(config?)`

Explicitly initialize the database before making any calls. Optional — the DB is also auto-initialized on first call to `withCostPilot`.

```ts
import { initCostPilot } from "costpilot";

initCostPilot();                                    // uses ~/.costpilot/usage.db
initCostPilot({ dbPath: "/custom/path/usage.db" }); // custom path
```

### Query Functions

```ts
import {
  getAllUsage,
  getUsageByTimeRange,
  getTopModelsByTotalCost,
  getTotalCostByTimeRange,
  getSummary,
  getAllInsights,
  detectSpikes,
  getTopModelInsights,
} from "costpilot";

// All usage records (most recent first, max 1000)
const records = getAllUsage();

// Usage in a time range
const records = getUsageByTimeRange(Date.now() - 86_400_000, Date.now());

// Top models by total spend
const top = getTopModelsByTotalCost(10);
// [{ model: "gpt-4o", totalCost: 0.043, callCount: 32 }, ...]

// Total cost in a time window
const cost = getTotalCostByTimeRange(Date.now() - 3_600_000, Date.now());

// Aggregate summary
const summary = getSummary();
// { totalCostUsd, totalCalls, totalTokens, avgCostPerCall }

// All insights (spikes + model dominance)
const insights = getAllInsights();
// [{ type: "spike", severity: "critical", message: "...", data: {...} }]
```

### Types

```ts
import type { UsageRecord, InsightResult, CostPilotConfig } from "costpilot";

interface UsageRecord {
  id?: number;
  timestamp: number;       // Unix ms
  provider: string;        // "openai" | "anthropic" | "gemini"
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
  endpoint?: string;       // e.g. "chat.completions.create"
  metadata?: Record<string, unknown>;
}

interface InsightResult {
  type: "spike" | "top_model" | "expensive_endpoint";
  severity: "info" | "warning" | "critical";
  message: string;
  data?: Record<string, unknown>;
}

interface CostPilotConfig {
  provider?: "openai" | "anthropic" | "gemini";
  dbPath?: string;   // defaults to ~/.costpilot/usage.db
  silent?: boolean;  // suppress console warnings
}
```

## Supported Models

Pricing is per the official provider pages as of March 2025.

### OpenAI

| Model | Input (per 1M) | Output (per 1M) |
|-------|---------------|-----------------|
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4-turbo | $10.00 | $30.00 |
| gpt-4 | $30.00 | $60.00 |
| gpt-3.5-turbo | $0.50 | $1.50 |
| o1 | $15.00 | $60.00 |
| o1-mini | $3.00 | $12.00 |
| o3-mini | $1.10 | $4.40 |

### Anthropic

| Model | Input (per 1M) | Output (per 1M) |
|-------|---------------|-----------------|
| claude-3-5-sonnet-20241022 | $3.00 | $15.00 |
| claude-3-5-haiku-20241022 | $0.80 | $4.00 |
| claude-3-opus-20240229 | $15.00 | $75.00 |
| claude-3-haiku-20240307 | $0.25 | $1.25 |

### Google Gemini

| Model | Input (per 1M) | Output (per 1M) |
|-------|---------------|-----------------|
| gemini-1.5-pro | $3.50 | $10.50 |
| gemini-1.5-flash | $0.075 | $0.30 |
| gemini-2.0-flash | $0.10 | $0.40 |
| gemini-2.0-flash-lite | $0.075 | $0.30 |

To add or update a model, edit `PRICING` in `src/cost/pricing.ts` and rebuild.

## How It Works

CostPilot uses a JavaScript [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) to intercept calls on your AI client without modifying any of its behavior. When a tracked method returns, CostPilot reads the `usage` field from the response, calculates the cost, and enqueues a write to SQLite via `setImmediate` — so your API call is never delayed.

```
withCostPilot(client)
  → Proxy intercepts method calls
  → Detects provider from client shape
  → On response: reads usage.prompt_tokens + usage.completion_tokens
  → Calculates cost from pricing table
  → Queues async SQLite write (never blocks)
  → Returns result to your code immediately
```

## Data Storage

- **Location**: `~/.costpilot/usage.db` (SQLite, WAL mode)
- **Schema**: Single `usage` table with timestamp, provider, model, token counts, cost, duration
- **No network**: All data stays on your machine

To clear all data:

```bash
rm ~/.costpilot/usage.db
```

## Known Limitations

- **Streaming** (`stream: true`) is not tracked — token counts are unavailable mid-stream. Calls with streaming are silently skipped.
- **Only the OpenAI SDK** is currently wrapped. Anthropic and Gemini wrappers are planned for v0.2.
- **Unknown models** are logged with `costUsd: 0` — add the model to the pricing table to get cost tracking.

## Roadmap

- Anthropic and Gemini SDK wrappers
- Streaming cost estimation
- Budget limits with hard cutoffs
- CSV / JSON export
- Cost alerts (Slack, email)
- Team analytics with per-user attribution

## License

MIT
