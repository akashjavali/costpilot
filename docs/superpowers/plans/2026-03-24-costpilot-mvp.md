# CostPilot MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready npm package + CLI tool that wraps AI API clients, tracks token usage, calculates costs, stores data locally in SQLite, and surfaces insights via CLI commands.

**Architecture:** SDK wrapper intercepts AI client calls via a Proxy, captures token/timing metadata, and enqueues async writes to SQLite so API calls are never blocked. A CLI reads that database and renders tables + insights. Dual ESM/CJS build via tsup.

**Tech Stack:** TypeScript, tsup (build), better-sqlite3 (storage), commander (CLI), cli-table3 + chalk (output), vitest (tests)

---

## File Map

```
costpilot/
├── package.json                        # build, bin, exports
├── tsconfig.json                       # ESM base config
├── tsup.config.ts                      # dual ESM+CJS build
├── vitest.config.ts
├── .gitignore
├── src/
│   ├── index.ts                        # Public API re-exports
│   ├── core/
│   │   ├── types.ts                    # All shared interfaces
│   │   └── tracker.ts                  # withCostPilot() Proxy wrapper + initCostPilot()
│   ├── providers/
│   │   └── openai.ts                   # OpenAI-specific request/response parser
│   ├── cost/
│   │   ├── pricing.ts                  # Static model → $/token config
│   │   └── engine.ts                   # calculateCost(model, inputTokens, outputTokens)
│   ├── storage/
│   │   ├── db.ts                       # SQLite singleton + schema init
│   │   └── queries.ts                  # insert, getAll, getByTimeRange, getTopModels
│   ├── insights/
│   │   └── engine.ts                   # detectSpikes(), topModels(), expensiveEndpoints()
│   ├── utils/
│   │   └── async-queue.ts              # Non-blocking fire-and-forget write queue
│   └── cli/
│       ├── index.ts                    # commander program entry + bin
│       ├── display.ts                  # Table/chalk formatting helpers
│       └── commands/
│           ├── report.ts               # `costpilot report`
│           ├── top.ts                  # `costpilot top`
│           └── anomalies.ts            # `costpilot anomalies`
└── tests/
    ├── cost/engine.test.ts
    ├── storage/queries.test.ts
    ├── insights/engine.test.ts
    ├── providers/openai.test.ts
    └── utils/async-queue.test.ts
```

---

## Task 1: Project Bootstrap

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "costpilot",
  "version": "0.1.0",
  "description": "Track, analyze, and optimize your AI API costs",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "costpilot": "./dist/cli/index.cjs"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit"
  },
  "keywords": ["ai", "cost", "openai", "anthropic", "tracking", "analytics"],
  "license": "MIT",
  "dependencies": {
    "better-sqlite3": "^9.4.3",
    "chalk": "^5.3.0",
    "cli-table3": "^0.6.3",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/node": "^20.11.0",
    "tsup": "^8.0.2",
    "typescript": "^5.3.3",
    "vitest": "^1.3.1"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020"],
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create tsup.config.ts**

```ts
import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
  },
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["cjs"],
    dts: false,
    sourcemap: true,
    clean: false,  // first entry already cleaned dist/; do not wipe it again
    banner: { js: "#!/usr/bin/env node" },
  },
]);
```

- [ ] **Step 4: Create vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
*.db
*.db-journal
coverage/
.DS_Store
```

- [ ] **Step 6: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json tsconfig.json tsup.config.ts vitest.config.ts .gitignore
git commit -m "chore: bootstrap project — package.json, tsconfig, tsup, vitest"
```

---

## Task 2: Core Types

**Files:**
- Create: `src/core/types.ts`

- [ ] **Step 1: Create src/core/types.ts**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(core): add shared TypeScript interfaces"
```

---

## Task 3: Pricing Engine

**Files:**
- Create: `src/cost/pricing.ts`
- Create: `src/cost/engine.ts`
- Create: `tests/cost/engine.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/cost/engine.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calculateCost, getPricing } from "../../src/cost/engine";

describe("calculateCost", () => {
  it("calculates gpt-4o cost correctly", () => {
    // gpt-4o: $2.50/1M input, $10.00/1M output
    const cost = calculateCost("gpt-4o", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(12.5, 4);
  });

  it("calculates gpt-4o-mini cost correctly", () => {
    // gpt-4o-mini: $0.15/1M input, $0.60/1M output
    const cost = calculateCost("gpt-4o-mini", 100_000, 50_000);
    expect(cost).toBeCloseTo(0.015 + 0.03, 6);
  });

  it("returns 0 for unknown model", () => {
    const cost = calculateCost("unknown-model-xyz", 1000, 1000);
    expect(cost).toBe(0);
  });

  it("handles zero tokens", () => {
    expect(calculateCost("gpt-4o", 0, 0)).toBe(0);
  });
});

describe("getPricing", () => {
  it("returns pricing for known model", () => {
    const pricing = getPricing("gpt-4o");
    expect(pricing).not.toBeNull();
    expect(pricing?.inputCostPer1M).toBe(2.5);
    expect(pricing?.outputCostPer1M).toBe(10.0);
  });

  it("returns null for unknown model", () => {
    expect(getPricing("nonexistent-model")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/cost/engine.test.ts
```

Expected: FAIL — `Cannot find module '../../src/cost/engine'`

- [ ] **Step 3: Create src/cost/pricing.ts**

```ts
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
```

- [ ] **Step 4: Create src/cost/engine.ts**

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test tests/cost/engine.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/cost/pricing.ts src/cost/engine.ts tests/cost/engine.test.ts
git commit -m "feat(cost): add pricing config and cost calculation engine"
```

---

## Task 4: Storage Layer

**Files:**
- Create: `src/storage/db.ts`
- Create: `src/storage/queries.ts`
- Create: `tests/storage/queries.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/storage/queries.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDb, closeDb } from "../../src/storage/db";
import {
  insertUsage,
  getAllUsage,
  getUsageByTimeRange,
  getTopModelsByTotalCost,
} from "../../src/storage/queries";
import type { UsageRecord } from "../../src/core/types";

function makeRecord(overrides: Partial<UsageRecord> = {}): UsageRecord {
  return {
    timestamp: Date.now(),
    provider: "openai",
    model: "gpt-4o",
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    costUsd: 0.00075,
    durationMs: 320,
    endpoint: "chat.completions.create",
    ...overrides,
  };
}

describe("Storage queries", () => {
  beforeEach(() => {
    initDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("inserts and retrieves a usage record", () => {
    const record = makeRecord();
    insertUsage(record);
    const rows = getAllUsage();
    expect(rows).toHaveLength(1);
    expect(rows[0].model).toBe("gpt-4o");
    expect(rows[0].costUsd).toBeCloseTo(0.00075);
  });

  it("filters by time range", () => {
    const now = Date.now();
    insertUsage(makeRecord({ timestamp: now - 10_000 }));
    insertUsage(makeRecord({ timestamp: now - 5_000 }));
    insertUsage(makeRecord({ timestamp: now + 5_000 }));
    const rows = getUsageByTimeRange(now - 7_000, now);
    expect(rows).toHaveLength(1);
  });

  it("returns top models by total cost", () => {
    insertUsage(makeRecord({ model: "gpt-4o",      costUsd: 1.0 }));
    insertUsage(makeRecord({ model: "gpt-4o",      costUsd: 2.0 }));
    insertUsage(makeRecord({ model: "gpt-4o-mini", costUsd: 0.1 }));
    const top = getTopModelsByTotalCost(5);
    expect(top[0].model).toBe("gpt-4o");
    expect(top[0].totalCost).toBeCloseTo(3.0);
    expect(top[1].model).toBe("gpt-4o-mini");
  });

  it("returns empty array when no records", () => {
    expect(getAllUsage()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/storage/queries.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create src/storage/db.ts**

```ts
import Database from "better-sqlite3";
import { homedir } from "os";
import { mkdirSync } from "fs";
import { join } from "path";

let db: Database.Database | null = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS usage (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp     INTEGER NOT NULL,
    provider      TEXT    NOT NULL,
    model         TEXT    NOT NULL,
    input_tokens  INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens  INTEGER NOT NULL DEFAULT 0,
    cost_usd      REAL    NOT NULL DEFAULT 0,
    duration_ms   INTEGER NOT NULL DEFAULT 0,
    endpoint      TEXT,
    metadata      TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage(timestamp);
  CREATE INDEX IF NOT EXISTS idx_usage_model     ON usage(model);
`;

export function getDefaultDbPath(): string {
  const dir = join(homedir(), ".costpilot");
  mkdirSync(dir, { recursive: true });
  return join(dir, "usage.db");
}

export function initDb(path?: string): Database.Database {
  const dbPath = path ?? getDefaultDbPath();
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

export function getDb(): Database.Database {
  if (!db) return initDb();
  return db;
}

export function closeDb(): void {
  db?.close();
  db = null;
}
```

- [ ] **Step 4: Create src/storage/queries.ts**

```ts
import { getDb } from "./db.js";
import type { UsageRecord } from "../core/types.js";

interface DbRow {
  id: number;
  timestamp: number;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
  duration_ms: number;
  endpoint: string | null;
  metadata: string | null;
}

function rowToRecord(row: DbRow): UsageRecord {
  return {
    id: row.id,
    timestamp: row.timestamp,
    provider: row.provider,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    costUsd: row.cost_usd,
    durationMs: row.duration_ms,
    endpoint: row.endpoint ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

export function insertUsage(record: UsageRecord): void {
  const db = getDb();
  // Explicit params — do NOT spread record (it may include `id` which is not a named param here)
  db.prepare(`
    INSERT INTO usage
      (timestamp, provider, model, input_tokens, output_tokens, total_tokens, cost_usd, duration_ms, endpoint, metadata)
    VALUES
      (@timestamp, @provider, @model, @inputTokens, @outputTokens, @totalTokens, @costUsd, @durationMs, @endpoint, @metadata)
  `).run({
    timestamp:    record.timestamp,
    provider:     record.provider,
    model:        record.model,
    inputTokens:  record.inputTokens,
    outputTokens: record.outputTokens,
    totalTokens:  record.totalTokens,
    costUsd:      record.costUsd,
    durationMs:   record.durationMs,
    endpoint:     record.endpoint ?? null,
    metadata:     record.metadata ? JSON.stringify(record.metadata) : null,
  });
}

export function getAllUsage(limit = 1000): UsageRecord[] {
  const db = getDb();
  return (
    db.prepare("SELECT * FROM usage ORDER BY timestamp DESC LIMIT ?")
      .all(limit) as DbRow[]
  ).map(rowToRecord);
}

export function getUsageByTimeRange(fromMs: number, toMs: number): UsageRecord[] {
  const db = getDb();
  return (
    db.prepare("SELECT * FROM usage WHERE timestamp BETWEEN ? AND ? ORDER BY timestamp DESC")
      .all(fromMs, toMs) as DbRow[]
  ).map(rowToRecord);
}

export function getTopModelsByTotalCost(limit = 10): Array<{ model: string; totalCost: number; callCount: number }> {
  const db = getDb();
  return db.prepare(`
    SELECT model,
           SUM(cost_usd) AS totalCost,
           COUNT(*)      AS callCount
    FROM usage
    GROUP BY model
    ORDER BY totalCost DESC
    LIMIT ?
  `).all(limit) as Array<{ model: string; totalCost: number; callCount: number }>;
}

export function getTotalCostByTimeRange(fromMs: number, toMs: number): number {
  const db = getDb();
  const row = db.prepare(
    "SELECT COALESCE(SUM(cost_usd), 0) AS total FROM usage WHERE timestamp BETWEEN ? AND ?"
  ).get(fromMs, toMs) as { total: number };
  return row.total;
}

export function getHourlyCosts(hours = 48): Array<{ hour: number; totalCost: number }> {
  const db = getDb();
  return db.prepare(`
    SELECT (timestamp / 3600000) AS hour,
           SUM(cost_usd)         AS totalCost
    FROM usage
    WHERE timestamp > ?
    GROUP BY hour
    ORDER BY hour ASC
  `).all(Date.now() - hours * 3_600_000) as Array<{ hour: number; totalCost: number }>;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test tests/storage/queries.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/storage/db.ts src/storage/queries.ts tests/storage/queries.test.ts
git commit -m "feat(storage): add SQLite schema, init, and query helpers"
```

---

## Task 5: Async Write Queue

**Files:**
- Create: `src/utils/async-queue.ts`
- Create: `tests/utils/async-queue.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/utils/async-queue.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { AsyncQueue } from "../../src/utils/async-queue";

describe("AsyncQueue", () => {
  it("executes enqueued tasks", () => {
    const queue = new AsyncQueue();
    const calls: number[] = [];
    queue.enqueue(() => calls.push(1));
    queue.enqueue(() => calls.push(2));
    queue.flush();
    expect(calls).toEqual([1, 2]);
  });

  it("does not throw when a task throws", () => {
    const queue = new AsyncQueue();
    queue.enqueue(() => { throw new Error("boom"); });
    expect(() => queue.flush()).not.toThrow();
  });

  it("multiple enqueues before flush all run", () => {
    const queue = new AsyncQueue();
    const count = { n: 0 };
    for (let i = 0; i < 10; i++) queue.enqueue(() => count.n++);
    queue.flush();
    expect(count.n).toBe(10);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test tests/utils/async-queue.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create src/utils/async-queue.ts**

```ts
type Task = () => void;

export class AsyncQueue {
  private queue: Task[] = [];
  private running = false;

  enqueue(task: Task): void {
    this.queue.push(task);
    if (!this.running) this.drain();
  }

  private drain(): void {
    this.running = true;
    setImmediate(() => {
      while (this.queue.length > 0) {
        const task = this.queue.shift()!;
        try {
          task();
        } catch {
          // Never crash the caller's process due to a logging failure
        }
      }
      this.running = false;
    });
  }

  /** Flush synchronously — for tests / process exit */
  flush(): void {
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try { task(); } catch { /* swallow */ }
    }
    this.running = false;
  }
}

export const writeQueue = new AsyncQueue();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test tests/utils/async-queue.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/async-queue.ts tests/utils/async-queue.test.ts
git commit -m "feat(utils): add non-blocking async write queue with tests"
```

---

## Task 6: OpenAI Provider Wrapper

**Files:**
- Create: `src/providers/openai.ts`
- Create: `src/core/tracker.ts`
- Create: `tests/providers/openai.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/providers/openai.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { wrapOpenAI } from "../../src/providers/openai";
import { initDb, closeDb } from "../../src/storage/db";
import { getAllUsage } from "../../src/storage/queries";

describe("wrapOpenAI", () => {
  beforeEach(() => {
    initDb(":memory:");
  });

  afterEach(() => {
    closeDb();
  });

  it("returns a Proxy that passes through to the original client", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      model: "gpt-4o",
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      choices: [{ message: { content: "Hello" } }],
    });

    const fakeClient = {
      chat: { completions: { create: mockCreate } },
    };

    const wrapped = wrapOpenAI(fakeClient as any);
    const result = await wrapped.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hi" }],
    });

    expect(mockCreate).toHaveBeenCalledOnce();
    expect(result.choices[0].message.content).toBe("Hello");
  });

  it("logs usage to storage after a successful call", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      model: "gpt-4o",
      usage: { prompt_tokens: 200, completion_tokens: 80, total_tokens: 280 },
      choices: [],
    });

    const fakeClient = { chat: { completions: { create: mockCreate } } };
    const wrapped = wrapOpenAI(fakeClient as any);

    await wrapped.chat.completions.create({
      model: "gpt-4o",
      messages: [],
    });

    // Flush the async queue synchronously for test assertions
    const { writeQueue } = await import("../../src/utils/async-queue");
    writeQueue.flush();

    const rows = getAllUsage();
    expect(rows).toHaveLength(1);
    expect(rows[0].inputTokens).toBe(200);
    expect(rows[0].outputTokens).toBe(80);
    expect(rows[0].costUsd).toBeGreaterThan(0);
  });

  it("re-throws when the underlying call fails", async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error("API down"));
    const fakeClient = { chat: { completions: { create: mockCreate } } };
    const wrapped = wrapOpenAI(fakeClient as any);

    await expect(
      wrapped.chat.completions.create({ model: "gpt-4o", messages: [] })
    ).rejects.toThrow("API down");
  });

  it("logs a failed call record with costUsd=0 when the API throws", async () => {
    const mockCreate = vi.fn().mockRejectedValue(new Error("timeout"));
    const fakeClient = { chat: { completions: { create: mockCreate } } };
    const wrapped = wrapOpenAI(fakeClient as any);

    await expect(
      wrapped.chat.completions.create({ model: "gpt-4o", messages: [] })
    ).rejects.toThrow();

    const { writeQueue } = await import("../../src/utils/async-queue");
    writeQueue.flush();

    const rows = getAllUsage();
    expect(rows).toHaveLength(1);
    expect(rows[0].costUsd).toBe(0);
    expect(rows[0].inputTokens).toBe(0);
  });

  it("skips logging for streaming responses (async iterable)", async () => {
    // Streaming returns an async iterable — no `usage` field on top-level result
    async function* fakeStream() { yield { choices: [] }; }
    const mockCreate = vi.fn().mockResolvedValue(fakeStream());
    const fakeClient = { chat: { completions: { create: mockCreate } } };
    const wrapped = wrapOpenAI(fakeClient as any);

    await wrapped.chat.completions.create({ model: "gpt-4o", messages: [], stream: true });

    const { writeQueue } = await import("../../src/utils/async-queue");
    writeQueue.flush();

    // No record logged — streaming not yet supported (documented limitation)
    const rows = getAllUsage();
    expect(rows).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/providers/openai.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create src/providers/openai.ts**

```ts
import { calculateCost } from "../cost/engine.js";
import { insertUsage } from "../storage/queries.js";
import { writeQueue } from "../utils/async-queue.js";
import type { UsageRecord } from "../core/types.js";

type AnyFn = (...args: unknown[]) => unknown;

/** Recursively wrap an object — intercepts all async method calls */
export function wrapOpenAI<T extends object>(client: T): T {
  return deepProxy(client, "openai");
}

function deepProxy<T extends object>(target: T, provider: string, path = ""): T {
  return new Proxy(target, {
    get(obj, prop: string) {
      const value = obj[prop as keyof T];
      const currentPath = path ? `${path}.${prop}` : prop;

      if (typeof value === "function") {
        return interceptFn(value as AnyFn, provider, currentPath);
      }

      if (value && typeof value === "object") {
        return deepProxy(value as object, provider, currentPath);
      }

      return value;
    },
  });
}

function interceptFn(fn: AnyFn, provider: string, path: string): AnyFn {
  return async function (this: unknown, ...args: unknown[]) {
    const startMs = Date.now();
    const requestModel = (args[0] as { model?: string })?.model ?? "unknown";

    let result: unknown;
    try {
      result = await fn.apply(this, args);
    } catch (err) {
      // Log failed call with zero cost so it's visible in reports
      const durationMs = Date.now() - startMs;
      writeQueue.enqueue(() =>
        insertUsage({
          timestamp: startMs,
          provider,
          model: requestModel,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          durationMs,
          endpoint: path,
          metadata: { error: (err as Error).message },
        })
      );
      throw err; // always re-throw — never suppress API errors
    }

    const durationMs = Date.now() - startMs;

    // Streaming returns an async iterable — no top-level `usage` field.
    // We skip logging for now; streaming support is a Phase 2 item.
    if (result && typeof result === "object" && "usage" in result) {
      const response = result as {
        model: string;
        usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };

      const {
        prompt_tokens: inputTokens = 0,
        completion_tokens: outputTokens = 0,
        total_tokens: totalTokens = 0,
      } = response.usage ?? {};

      const model = response.model ?? requestModel;
      const costUsd = calculateCost(model, inputTokens, outputTokens);

      writeQueue.enqueue(() =>
        insertUsage({
          timestamp: startMs,
          provider,
          model,
          inputTokens,
          outputTokens,
          totalTokens,
          costUsd,
          durationMs,
          endpoint: path,
        })
      );
    }

    return result;
  };
}
```

- [ ] **Step 4: Create src/core/tracker.ts**

```ts
import { wrapOpenAI } from "../providers/openai.js";
import type { CostPilotConfig } from "./types.js";
import { initDb } from "../storage/db.js";

let initialized = false;

export function initCostPilot(config: CostPilotConfig): void {
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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test tests/providers/openai.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/providers/openai.ts src/core/tracker.ts tests/providers/openai.test.ts
git commit -m "feat(providers): add OpenAI Proxy wrapper with async usage logging"
```

---

## Task 7: Insights Engine

**Files:**
- Create: `src/insights/engine.ts`
- Create: `tests/insights/engine.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/insights/engine.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectSpikes, getTopModelInsights, getSummary } from "../../src/insights/engine";
import { initDb, closeDb } from "../../src/storage/db";
import { insertUsage } from "../../src/storage/queries";
import type { UsageRecord } from "../../src/core/types";

function makeRecord(costUsd: number, timestamp: number, model = "gpt-4o"): UsageRecord {
  return {
    timestamp,
    provider: "openai",
    model,
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    costUsd,
    durationMs: 300,
  };
}

describe("Insights Engine", () => {
  beforeEach(() => initDb(":memory:"));
  afterEach(() => closeDb());

  describe("detectSpikes", () => {
    it("detects a 3x cost spike vs previous window", () => {
      const HOUR = 3_600_000;
      // Use a fixed base time aligned to an hour boundary to guarantee distinct buckets
      const base = Math.floor(Date.now() / HOUR) * HOUR;

      // Previous 24h window: 24 records, each in its own hour slot, $0.10 each = $2.40 total
      for (let i = 48; i > 24; i--) {
        insertUsage(makeRecord(0.10, base - i * HOUR + 1)); // +1ms to stay in that bucket
      }
      // Current 24h window: 24 records at $0.33 each = $7.92 (~3.3x)
      for (let i = 24; i > 0; i--) {
        insertUsage(makeRecord(0.33, base - i * HOUR + 1));
      }

      const spikes = detectSpikes();
      expect(spikes.length).toBeGreaterThan(0);
      expect(spikes[0].severity).toMatch(/warning|critical/);
      expect(spikes[0].message).toMatch(/\d+(\.\d+)?x/);
    });

    it("returns empty array when cost is stable", () => {
      const HOUR = 3_600_000;
      const base = Math.floor(Date.now() / HOUR) * HOUR;
      for (let i = 48; i > 0; i--) {
        insertUsage(makeRecord(0.10, base - i * HOUR + 1));
      }
      expect(detectSpikes()).toHaveLength(0);
    });
  });

  describe("getTopModelInsights", () => {
    it("flags model that dominates cost", () => {
      const now = Date.now();
      insertUsage(makeRecord(9.0, now, "gpt-4o"));
      insertUsage(makeRecord(0.5, now, "gpt-4o-mini"));
      insertUsage(makeRecord(0.5, now, "gpt-3.5-turbo"));

      const insights = getTopModelInsights();
      expect(insights.some((i) => i.message.includes("gpt-4o"))).toBe(true);
    });
  });

  describe("getSummary", () => {
    it("returns total cost and call count", () => {
      const now = Date.now();
      insertUsage(makeRecord(1.0, now));
      insertUsage(makeRecord(2.0, now));
      const summary = getSummary();
      expect(summary.totalCostUsd).toBeCloseTo(3.0);
      expect(summary.totalCalls).toBe(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/insights/engine.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create src/insights/engine.ts**

```ts
import type { InsightResult } from "../core/types.js";
import { getHourlyCosts, getTopModelsByTotalCost } from "../storage/queries.js";
import { getDb } from "../storage/db.js";

const SPIKE_THRESHOLD = 2.0;

export function detectSpikes(windowHours = 24): InsightResult[] {
  const hourlyCosts = getHourlyCosts(windowHours * 2);
  if (hourlyCosts.length < 2) return [];

  const midpoint = Math.floor(hourlyCosts.length / 2);
  const previous = hourlyCosts.slice(0, midpoint);
  const current = hourlyCosts.slice(midpoint);

  const prevTotal = previous.reduce((s, h) => s + h.totalCost, 0);
  const currTotal = current.reduce((s, h) => s + h.totalCost, 0);

  if (prevTotal === 0 || currTotal === 0) return [];

  const ratio = currTotal / prevTotal;
  if (ratio < SPIKE_THRESHOLD) return [];

  const severity = ratio >= 3 ? "critical" : "warning";
  return [
    {
      type: "spike",
      severity,
      message: `Cost increased ${ratio.toFixed(1)}x in last ${windowHours}h vs previous ${windowHours}h`,
      data: { ratio, prevTotal, currTotal, windowHours },
    },
  ];
}

export function getTopModelInsights(dominanceThreshold = 0.6): InsightResult[] {
  const top = getTopModelsByTotalCost(10);
  if (top.length === 0) return [];

  const grandTotal = top.reduce((s, m) => s + m.totalCost, 0);
  if (grandTotal === 0) return [];

  const insights: InsightResult[] = [];
  for (const entry of top) {
    const pct = entry.totalCost / grandTotal;
    if (pct >= dominanceThreshold) {
      insights.push({
        type: "top_model",
        severity: "info",
        message: `${(pct * 100).toFixed(0)}% of cost from ${entry.model} — consider a cheaper model`,
        data: { model: entry.model, pct, totalCost: entry.totalCost },
      });
    }
  }
  return insights;
}

export function getSummary(): {
  totalCostUsd: number;
  totalCalls: number;
  totalTokens: number;
  avgCostPerCall: number;
} {
  // Use SQL aggregation — never load all rows into memory
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(cost_usd), 0)    AS totalCostUsd,
      COUNT(*)                       AS totalCalls,
      COALESCE(SUM(total_tokens), 0) AS totalTokens
    FROM usage
  `).get() as { totalCostUsd: number; totalCalls: number; totalTokens: number };

  return {
    ...row,
    avgCostPerCall: row.totalCalls > 0 ? row.totalCostUsd / row.totalCalls : 0,
  };
}

export function getAllInsights(): InsightResult[] {
  return [...detectSpikes(), ...getTopModelInsights()];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/insights/engine.test.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/insights/engine.ts tests/insights/engine.test.ts
git commit -m "feat(insights): add spike detection, top model analysis, and summary"
```

---

## Task 8: CLI Display Helpers

**Files:**
- Create: `src/cli/display.ts`

- [ ] **Step 1: Create src/cli/display.ts**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/display.ts
git commit -m "feat(cli): add display helpers — table, colors, formatters"
```

---

## Task 9: CLI Commands

**Files:**
- Create: `src/cli/commands/report.ts`
- Create: `src/cli/commands/top.ts`
- Create: `src/cli/commands/anomalies.ts`

- [ ] **Step 1: Create src/cli/commands/report.ts**

```ts
import { getAllUsage, getTotalCostByTimeRange } from "../../storage/queries.js";
import {
  formatUSD, formatDate, formatDuration,
  printTable, printSectionHeader
} from "../display.js";

export function runReport(options: { hours?: number } = {}): void {
  const hours = options.hours ?? 24;
  const fromMs = Date.now() - hours * 3_600_000;
  const toMs = Date.now();

  const records = getAllUsage(500);
  const recentRecords = records.filter((r) => r.timestamp >= fromMs);
  const totalCost = getTotalCostByTimeRange(fromMs, toMs);

  printSectionHeader(`CostPilot Report — Last ${hours}h`);

  if (recentRecords.length === 0) {
    console.log("\nNo usage recorded yet. Wrap your AI client with withCostPilot() to start tracking.\n");
    return;
  }

  console.log(`\nTotal: ${formatUSD(totalCost)}  |  Calls: ${recentRecords.length}\n`);

  printTable(
    ["Time", "Model", "Input", "Output", "Cost", "Duration"],
    recentRecords.slice(0, 20).map((r) => [
      formatDate(r.timestamp),
      r.model,
      r.inputTokens.toLocaleString(),
      r.outputTokens.toLocaleString(),
      formatUSD(r.costUsd),
      formatDuration(r.durationMs),
    ])
  );

  if (recentRecords.length > 20) {
    console.log(`\n  ... and ${recentRecords.length - 20} more calls\n`);
  }
}
```

- [ ] **Step 2: Create src/cli/commands/top.ts**

```ts
import { getTopModelsByTotalCost } from "../../storage/queries.js";
import { formatUSD, printTable, printSectionHeader } from "../display.js";

export function runTop(options: { limit?: number } = {}): void {
  const limit = options.limit ?? 10;
  const top = getTopModelsByTotalCost(limit);

  printSectionHeader("Top Models by Cost");

  if (top.length === 0) {
    console.log("\nNo usage data yet.\n");
    return;
  }

  const grandTotal = top.reduce((s, m) => s + m.totalCost, 0);

  printTable(
    ["Model", "Total Cost", "Calls", "Avg/Call", "Share"],
    top.map((m) => [
      m.model,
      formatUSD(m.totalCost),
      m.callCount.toString(),
      formatUSD(m.totalCost / m.callCount),
      `${((m.totalCost / grandTotal) * 100).toFixed(1)}%`,
    ])
  );

  console.log(`\n  Grand total: ${formatUSD(grandTotal)}\n`);
}
```

- [ ] **Step 3: Create src/cli/commands/anomalies.ts**

```ts
import { getAllInsights, getSummary } from "../../insights/engine.js";
import { formatUSD, printInsight, printSectionHeader } from "../display.js";

export function runAnomalies(): void {
  printSectionHeader("CostPilot Insights & Anomalies");

  const summary = getSummary();
  console.log(`\nTotal tracked: ${formatUSD(summary.totalCostUsd)} across ${summary.totalCalls} calls`);
  console.log(`Avg per call:  ${formatUSD(summary.avgCostPerCall)}\n`);

  const insights = getAllInsights();

  if (insights.length === 0) {
    console.log("✅ No anomalies detected. Usage looks normal.\n");
    return;
  }

  for (const insight of insights) {
    printInsight(insight.severity, insight.message);
  }
  console.log();
}
```

- [ ] **Step 4: Commit**

```bash
git add src/cli/commands/report.ts src/cli/commands/top.ts src/cli/commands/anomalies.ts
git commit -m "feat(cli): add report, top, and anomalies commands"
```

---

## Task 10: CLI Entry Point

**Files:**
- Create: `src/cli/index.ts`

- [ ] **Step 1: Create src/cli/index.ts**

```ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat(cli): wire up commander program with all commands"
```

---

## Task 11: Public API & Exports

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create src/index.ts**

```ts
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
```

- [ ] **Step 2: Verify TypeScript is clean**

```bash
npm run lint
```

Expected: 0 errors.

- [ ] **Step 3: Build the package**

```bash
npm run build
```

Expected: `dist/` created with `index.js`, `index.cjs`, `index.d.ts`, `cli/index.cjs`.

- [ ] **Step 4: Verify CLI runs**

```bash
node dist/cli/index.cjs --help
```

Expected: Shows help menu with `report`, `top`, `anomalies` commands.

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: add public API exports and verified build"
```

---

## Task 12: Full Test Suite + Smoke Test

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests in `tests/cost/`, `tests/storage/`, `tests/insights/`, `tests/providers/` pass.

- [ ] **Step 2: Smoke test with seed data**

Run this one-shot script (Node, not committed):

```js
// node seed.mjs
import { initDb } from "./dist/index.js";
import { insertUsage } from "./dist/index.js";

initDb();
const now = Date.now();
const hour = 3_600_000;

for (let i = 48; i > 24; i--) {
  insertUsage({
    timestamp: now - i * hour, provider: "openai", model: "gpt-4o-mini",
    inputTokens: 500, outputTokens: 200, totalTokens: 700,
    costUsd: 0.000195, durationMs: 280,
  });
}
for (let i = 24; i > 0; i--) {
  insertUsage({
    timestamp: now - i * hour, provider: "openai", model: "gpt-4o",
    inputTokens: 2000, outputTokens: 800, totalTokens: 2800,
    costUsd: 0.013, durationMs: 1200,
  });
}
console.log("Seeded 48 records.");
```

```bash
node seed.mjs
node dist/cli/index.cjs report
node dist/cli/index.cjs top
node dist/cli/index.cjs anomalies
```

Expected:
- `report` shows a table of 20 rows, total cost shown
- `top` shows gpt-4o at top with ~90% share
- `anomalies` shows a spike warning

- [ ] **Step 3: Clean up seed data**

```bash
rm seed.mjs
rm -f ~/.costpilot/usage.db
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify full test suite passes and CLI smoke test clears"
```

---

## Task 13: README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README.md with the following content**

```markdown
# CostPilot

Track, analyze, and optimize your AI API costs — locally, with zero config.

## Install

\`\`\`bash
npm install costpilot
\`\`\`

## Quick Start

\`\`\`ts
import OpenAI from "openai";
import { withCostPilot } from "costpilot";

// One-line wrap — use the client exactly as before
const openai = withCostPilot(new OpenAI());

const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }],
});
\`\`\`

All usage is tracked automatically. No tokens leave your machine.

## CLI

\`\`\`bash
npx costpilot report          # Usage report for last 24h
npx costpilot report -h 72   # Last 72h
npx costpilot top             # Top models by total cost + share
npx costpilot anomalies       # Detect cost spikes and get optimization hints
\`\`\`

## Supported Models

| Provider  | Models |
|-----------|--------|
| OpenAI    | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo, o1, o1-mini, o3-mini |
| Anthropic | claude-3-5-sonnet, claude-3-5-haiku, claude-3-opus, claude-3-haiku |
| Gemini    | gemini-1.5-pro, gemini-1.5-flash, gemini-2.0-flash |

Pricing is per the official provider pricing pages as of 2025-03. Update `src/cost/pricing.ts` to refresh.

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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with install, quick start, and CLI usage"
```

---

## Summary

| Task | Builds | Tests |
|------|--------|-------|
| 1 | Project scaffold | `npm run lint` |
| 2 | Shared types | (checked across all tasks) |
| 3 | Cost engine | `npm test tests/cost/` |
| 4 | SQLite storage | `npm test tests/storage/` |
| 5 | Async queue | `npm test tests/utils/` |
| 6 | OpenAI wrapper | `npm test tests/providers/` |
| 7 | Insights engine | `npm test tests/insights/` |
| 8 | CLI display helpers | (visual — Task 12) |
| 9 | CLI commands | (visual — Task 12) |
| 10 | CLI entry point | `node dist/cli/index.cjs --help` |
| 11 | Public exports + build | `npm run build` |
| 12 | Smoke test + cleanup | seed script |
| 13 | README | documentation |

---

## Phase 2 Roadmap

### SaaS Dashboard
- Next.js app with shadcn/ui
- Recharts time-series cost graphs
- Per-endpoint breakdown view
- Auth: Clerk or Auth.js

### Alerts
- Daily digest email (Resend)
- Slack webhook on spike detection
- Budget hard limits with cutoffs

### Team Analytics
- SQLite → Postgres migration path
- Per-user attribution (`userId` field on `UsageRecord`)
- Team dashboard with cost allocation

### Optimization Engine
- Auto-suggest model downgrades ("gpt-4o → gpt-4o-mini saves 93%")
- Prompt compression hints
- Cache detection for repeated identical prompts

### More Providers
- Anthropic SDK wrapper
- Google Gemini SDK wrapper
- LangChain middleware integration
