type Task<T> = () => Promise<T>;

export class Coalescer {
  private inflight = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: Task<T>): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const p = task().finally(() => {
      // Clear only if still pointing to same promise
      const cur = this.inflight.get(key);
      if (cur === p) this.inflight.delete(key);
    });
    this.inflight.set(key, p);
    return p;
  }
}


