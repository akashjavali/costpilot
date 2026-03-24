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
