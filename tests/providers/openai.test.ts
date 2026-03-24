import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { wrapOpenAI } from "../../src/providers/openai";
import { initDb, closeDb } from "../../src/storage/db";
import { getAllUsage } from "../../src/storage/queries";
import { writeQueue } from "../../src/utils/async-queue";

describe("wrapOpenAI", () => {
  beforeEach(() => {
    // Flush any leftover tasks from previous tests before opening a fresh DB
    writeQueue.flush();
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
