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
