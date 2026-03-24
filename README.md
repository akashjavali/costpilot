# CostPilot

[![npm version](https://img.shields.io/npm/v/costpilot)](https://www.npmjs.com/package/costpilot)
[![npm downloads](https://img.shields.io/npm/dm/costpilot)](https://www.npmjs.com/package/costpilot)
[![license](https://img.shields.io/npm/l/costpilot)](LICENSE)
[![node](https://img.shields.io/node/v/costpilot)](https://www.npmjs.com/package/costpilot)

Track, analyze, and optimize your AI API costs — locally, with zero config.

All usage is stored in SQLite at `~/.costpilot/usage.db`. No cloud, no account, no telemetry.

---

## Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [CLI](#cli)
- [SDK API](#sdk-api)
- [Supported Models](#supported-models)
- [How It Works](#how-it-works)
- [Troubleshooting](#troubleshooting)

---

## Installation

```bash
npm install costpilot
```

For the CLI, install globally:

```bash
npm install -g costpilot
```

**Requirements:** Node.js 18+

---

## Quick Start

Wrap your existing OpenAI client with one line. The rest of your code stays exactly the same.

```ts
import OpenAI from "openai";
import { withCostPilot } from "costpilot";

const openai = withCostPilot(new OpenAI());

// Use it exactly as you normally would
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});

console.log(response.choices[0].message.content);
// Cost is logged automatically to ~/.costpilot/usage.db
```

Then check your spending:

```bash
costpilot report
```

---

## CLI

### `costpilot report`

Usage report for the last N hours.

```bash
costpilot report           # last 24h (default)
costpilot report -h 48     # last 48h
costpilot report -h 168    # last 7 days
```

```
CostPilot Report — Last 24h
───────────────────────────

Total: $0.0530  |  Calls: 47

┌────────────────────────┬─────────────┬───────┬────────┬─────────┬──────────┐
│ Time                   │ Model       │ Input │ Output │ Cost    │ Duration │
├────────────────────────┼─────────────┼───────┼────────┼─────────┼──────────┤
│ 24/03/2026, 6:18:35 pm │ gpt-4o      │ 314   │ 64     │ $0.0014 │ 430ms    │
│ 24/03/2026, 6:18:23 pm │ gpt-4o-mini │ 54    │ 136    │ $0.090m │ 210ms    │
└────────────────────────┴─────────────┴───────┴────────┴─────────┴──────────┘
```

### `costpilot top`

Models ranked by total spend.

```bash
costpilot top              # top 10 (default)
costpilot top -n 5         # top 5
```

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

### `costpilot anomalies`

Detects cost spikes and surfaces optimization hints.

```bash
costpilot anomalies
```

```
CostPilot Insights & Anomalies
──────────────────────────────

Total tracked: $0.0530 across 47 calls
Avg per call:  $0.0011

🚨 Cost increased 17.2x in last 24h vs previous 24h
💡 81% of cost from gpt-4o — consider a cheaper model
```

---

## SDK API

### `withCostPilot(client, config?)`

Wraps an AI client with a transparent Proxy. All calls pass through unchanged — costs are logged as a side effect.

```ts
import { withCostPilot } from "costpilot";

// Default — uses ~/.costpilot/usage.db
const client = withCostPilot(new OpenAI());

// Custom DB path
const client = withCostPilot(new OpenAI(), {
  dbPath: "/custom/path/usage.db",
});
```

### `initCostPilot(config?)`

Explicitly initialize the database. Optional — `withCostPilot` auto-initializes on first call, but calling this early lets you set a custom DB path before any calls happen.

```ts
import { initCostPilot } from "costpilot";

initCostPilot();                                     // ~/.costpilot/usage.db
initCostPilot({ dbPath: "/custom/path/usage.db" });  // custom path
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
} from "costpilot";
```

#### `getAllUsage(limit?)`

Returns all usage records, most recent first. Default limit: 1000.

```ts
const records = getAllUsage();
const records = getAllUsage(50); // last 50 records
```

#### `getUsageByTimeRange(fromMs, toMs)`

Records between two Unix millisecond timestamps.

```ts
const last24h = getUsageByTimeRange(Date.now() - 86_400_000, Date.now());
```

#### `getTopModelsByTotalCost(limit?)`

Models ranked by total spend. Default limit: 10.

```ts
const top = getTopModelsByTotalCost(5);
// [{ model: "gpt-4o", totalCost: 0.043, callCount: 32 }, ...]
```

#### `getTotalCostByTimeRange(fromMs, toMs)`

Total cost (USD) in a time window.

```ts
const costToday = getTotalCostByTimeRange(Date.now() - 86_400_000, Date.now());
// 0.053
```

#### `getSummary()`

Aggregate stats across all tracked usage.

```ts
const summary = getSummary();
// {
//   totalCostUsd: 0.053,
//   totalCalls: 47,
//   totalTokens: 28400,
//   avgCostPerCall: 0.00113
// }
```

#### `getAllInsights()`

All active insights — cost spikes and model dominance warnings.

```ts
const insights = getAllInsights();
// [
//   {
//     type: "spike",
//     severity: "critical",
//     message: "Cost increased 17.2x in last 24h vs previous 24h",
//     data: { ratio: 17.2, prevTotal: 0.003, currTotal: 0.053, windowHours: 24 }
//   }
// ]
```

### Types

```ts
import type { UsageRecord, InsightResult, CostPilotConfig } from "costpilot";

interface UsageRecord {
  id?: number;
  timestamp: number;       // Unix ms
  provider: string;        // "openai" | "anthropic" | "gemini"
  model: string;           // e.g. "gpt-4o"
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
  dbPath?: string;   // defaults to ~/.costpilot/usage.db
  silent?: boolean;  // suppress console warnings
}
```

---

## Supported Models

Pricing sourced from official provider pages (March 2025). To add or update a model, edit the `PRICING` map in `src/cost/pricing.ts`.

### OpenAI

| Model | Input / 1M tokens | Output / 1M tokens |
|-------|------------------|-------------------|
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| gpt-4-turbo | $10.00 | $30.00 |
| gpt-4 | $30.00 | $60.00 |
| gpt-3.5-turbo | $0.50 | $1.50 |
| o1 | $15.00 | $60.00 |
| o1-mini | $3.00 | $12.00 |
| o3-mini | $1.10 | $4.40 |

### Anthropic

| Model | Input / 1M tokens | Output / 1M tokens |
|-------|------------------|-------------------|
| claude-3-5-sonnet-20241022 | $3.00 | $15.00 |
| claude-3-5-haiku-20241022 | $0.80 | $4.00 |
| claude-3-opus-20240229 | $15.00 | $75.00 |
| claude-3-haiku-20240307 | $0.25 | $1.25 |

### Google Gemini

| Model | Input / 1M tokens | Output / 1M tokens |
|-------|------------------|-------------------|
| gemini-1.5-pro | $3.50 | $10.50 |
| gemini-1.5-flash | $0.075 | $0.30 |
| gemini-2.0-flash | $0.10 | $0.40 |
| gemini-2.0-flash-lite | $0.075 | $0.30 |

---

## How It Works

CostPilot wraps your client in a JavaScript [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy). When a method call returns, CostPilot reads the `usage` field from the response, calculates cost from the pricing table, and queues an async SQLite write via `setImmediate` — your API call is never slowed down.

```
withCostPilot(client)
  → Proxy intercepts every method call
  → On response: reads usage.prompt_tokens + usage.completion_tokens
  → Calculates cost against pricing table
  → Queues SQLite write (setImmediate — non-blocking)
  → Returns response to your code immediately
```

**Edge cases handled automatically:**
- **Streaming** (`stream: true`) — silently skipped; token counts are unavailable during streaming
- **Failed calls** — logged with `costUsd: 0`, original error is re-thrown unchanged
- **Unknown models** — logged with `costUsd: 0`; add the model to the pricing table to track cost

**Data location:** `~/.costpilot/usage.db` (SQLite, WAL mode)

To clear all data:

```bash
rm ~/.costpilot/usage.db
```

---

## Troubleshooting

**`costpilot: command not found`**

Install globally:
```bash
npm install -g costpilot
```
Or use `npx costpilot report`.

---

**`No data` / empty report after making API calls**

The write queue is async (`setImmediate`). If your process exits immediately after the last API call, the write may not have flushed. Add a short delay or call `process.exit()` explicitly after your last call.

---

**Model shows `costUsd: 0`**

The model name isn't in the pricing table. Check the exact model string returned by the API (it may differ from what you passed in — e.g. `gpt-4o-2024-08-06` vs `gpt-4o`). You can add it yourself:

```ts
import { PRICING } from "costpilot";

PRICING["gpt-4o-2024-08-06"] = { inputCostPer1M: 2.5, outputCostPer1M: 10.0 };
```

---

**Permission error on `~/.costpilot/usage.db`**

CostPilot creates `~/.costpilot/` automatically. If it fails, check that your home directory is writable, or point to a custom path:

```ts
initCostPilot({ dbPath: "/tmp/costpilot.db" });
```

---

**Using CommonJS (`require`)**

```js
const { withCostPilot } = require("costpilot");
```

CostPilot ships both ESM and CJS builds — it works with `require` and `import` without any extra config.

---

## License

MIT
