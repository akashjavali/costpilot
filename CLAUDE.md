# CostPilot

An npm package and CLI tool that tracks AI API costs locally in SQLite, providing visibility into spending across multiple AI provider integrations.

## Project Overview

**CostPilot** wraps AI client SDKs (starting with OpenAI) using JavaScript Proxies to transparently intercept API calls and log costs. All cost data is stored locally in SQLite at `~/.costpilot/usage.db` — no cloud dependencies.

### Key Design Principles

- **Local-First**: All data stays on the user's machine in SQLite
- **Non-Blocking**: Async write queue ensures API calls complete instantly without waiting for database writes
- **Transparent**: Drop-in wrapper using Proxies — minimal integration friction
- **Type-Safe**: Full TypeScript implementation with type preservation through the wrapper

## Build & Dev Commands

```bash
npm run build        # ESM + CJS dual build via tsup
npm run dev          # Watch mode (incremental rebuild)
npm run lint         # TypeScript type check (tsc --noEmit)
npm test             # Run all tests via vitest
npm run test:watch   # Vitest watch mode
```

## Architecture

### SDK Wrapping Strategy

CostPilot uses JavaScript `Proxy` objects to intercept calls to AI client methods:

1. `withCostPilot(client)` wraps an already-instantiated client
2. Proxies trap all method calls and compare against known model-specific methods
3. When a tracked method is invoked, cost is calculated before the call returns
4. Costs are queued for async SQLite write via `setImmediate` — **never blocks the API call**

### Data Flow

```
withCostPilot(openaiClient)
  ↓
Proxy traps method calls
  ↓
Is it a tracked method? (e.g., chat.completions.create)
  ↓ Yes
Calculate cost from model + tokens
  ↓
Queue write to SQLite (setImmediate)
  ↓
Return result to caller immediately
```

### Database

- **Location**: `~/.costpilot/usage.db` (SQLite)
- **Singleton**: Created once on first call to `initCostPilot()`
- **Testing**: In-memory SQLite (`:memory:`) — never touches the real DB
- **Schema**: Single `usage` table with timestamp, model, cost, and token counts

### Write Queue

Async operations are batched using `setImmediate`:

- Prevents database I/O from blocking API responses
- Flushes automatically on process exit
- Tests must call `writeQueue.flush()` after async operations

### Special Cases

- **Streaming Responses**: Silently skipped (not logged) — token counts cannot be reliably determined
- **Failed API Calls**: Logged with `costUsd: 0`, then the original error is re-thrown

## Key Files

| File | Purpose |
|------|---------|
| `src/core/tracker.ts` | Public API: `withCostPilot()`, `initCostPilot()`, cost query functions |
| `src/providers/openai.ts` | OpenAI client Proxy wrapper — intercepts chat completions calls |
| `src/cost/pricing.ts` | Model pricing configuration — **update when API prices change** |
| `src/storage/db.ts` | SQLite singleton, schema initialization, query helpers |
| `src/cli/index.ts` | CLI entry point — cost reporting commands |
| `src/queue/writeQueue.ts` | Async write queue using `setImmediate` |

## Testing Patterns

### Test Setup

```typescript
import { initCostPilot, closeDb } from '@costpilot/core';

afterEach(() => {
  closeDb(); // Reset SQLite singleton between tests
});
```

### Testing Async Operations

```typescript
import { writeQueue } from '@costpilot/queue';

it('should log cost', async () => {
  const cost = await trackSomeOperation();
  await writeQueue.flush(); // Wait for async writes
  // Now query the in-memory DB
});
```

### In-Memory SQLite

Tests automatically use `:memory:` SQLite when `process.env.NODE_ENV === 'test'`. Never configure the real `~/.costpilot/usage.db` in tests.

## Adding a New AI Provider

1. Create `src/providers/{provider}.ts`
2. Export a wrapper function that returns a Proxy (follow OpenAI pattern)
3. Add model pricing to `src/cost/pricing.ts` in the `PRICING` map
4. Export the wrapper from `src/core/tracker.ts`
5. Update `README.md` with usage example

## Adding a New Model

1. Open `src/cost/pricing.ts`
2. Add entry to the `PRICING` map:
   ```typescript
   'gpt-4-turbo': {
     inputTokenCost: 0.01 / 1000,
     outputTokenCost: 0.03 / 1000,
   }
   ```
3. Rebuild (`npm run build`)
4. Tests will automatically pick up the new model

## Worktree Info

This project uses git worktrees for feature isolation:

- **Main branch**: `main`
- **Feature branch**: `feature/costpilot-mvp` (in `.worktrees/implement`)
- Work in progress commits go here before squashing to main

## Common Tasks

### Debugging a Test

```bash
npm run test:watch -- src/providers/openai.test.ts
```

### Type Check Only

```bash
npm run lint
```

### Build Before Publishing

```bash
npm run build
# Output in dist/ directory
```

### Clear Local Cost Data

```bash
rm ~/.costpilot/usage.db
```

## Conventions

- **Error Handling**: Failed API calls are logged but never throw during wrapping — the original error is re-thrown after logging
- **Null Safety**: Always check `response?.usage` before accessing token counts
- **Type Preservation**: Use TypeScript generics to preserve exact return types through the Proxy
- **Async Queue**: Never await database writes in the main code path — always use the write queue

## Future Considerations

- Support for streaming cost estimation (currently skipped)
- Additional providers (Anthropic, Google, etc.)
- Cost forecasting and budget alerts
- Batch export (CSV, JSON)
