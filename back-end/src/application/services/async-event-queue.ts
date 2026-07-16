export class AsyncEventQueue<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private waiter: (() => void) | null = null;
  private closed = false;
  private failure: unknown = null;

  push(item: T): void {
    if (this.closed) return;
    this.items.push(item);
    this.wake();
  }

  end(reason?: unknown): void {
    if (this.closed) return;
    this.closed = true;
    this.failure = reason ?? null;
    this.wake();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    for (; ;) {
      while (this.items.length > 0) {
        yield this.items.shift()!;
      }
      if (this.closed) {
        if (this.failure) throw this.failure;
        return;
      }
      await new Promise<void>((resolve) => {
        this.waiter = resolve;
      });
    }
  }

  private wake(): void {
    const waiter = this.waiter;
    this.waiter = null;
    waiter?.();
  }
}
