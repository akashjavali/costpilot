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
