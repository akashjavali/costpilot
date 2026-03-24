# CostPilot

Track, analyze, and optimize your AI API costs — locally, with zero config.

## Install

```bash
npm install costpilot
```

## Quick Start

```ts
import OpenAI from "openai";
import { withCostPilot } from "costpilot";

// One-line wrap — use the client exactly as before
const openai = withCostPilot(new OpenAI());

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
```

All usage is tracked automatically. No tokens leave your machine.

## CLI

```bash
npx costpilot report          # Usage report for last 24h
npx costpilot report -h 72   # Last 72h
npx costpilot top             # Top models by total cost + share
npx costpilot anomalies       # Detect cost spikes and get optimization hints
```

## Supported Models

| Provider  | Models |
|-----------|--------|
| OpenAI    | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo, o1, o1-mini, o3-mini |
| Anthropic | claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus, claude-3-haiku |
| Gemini    | gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash |

Pricing is per the official provider pricing pages as of March 2025. Update `src/cost/pricing.ts` to refresh.

## Data

Stored locally at `~/.costpilot/usage.db` (SQLite). No cloud, no account, no telemetry.

## Known Limitations (v0.1)

- Streaming responses (`stream: true`) are not tracked — silently skipped (Phase 2 item)
- Only the OpenAI SDK is wrapped; Anthropic and Gemini wrappers are in Phase 2

## Phase 2 Roadmap

- SaaS dashboard (Next.js + Recharts)
- Slack/email alerts on cost spikes
- Team analytics with per-user attribution
- Anthropic and Gemini SDK wrappers
- Optimization suggestions engine (auto-suggest model downgrades)
- Budget limits with hard cutoffs