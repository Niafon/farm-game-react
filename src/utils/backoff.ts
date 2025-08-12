export async function withBackoff<T>(fn: () => Promise<T>, opts?: { retries?: number; baseMs?: number }) {
  const retries = opts?.retries ?? 3;
  const baseMs = opts?.baseMs ?? 500;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries) throw e;
      const jitter = Math.floor(Math.random() * 100);
      const delay = baseMs * 2 ** attempt + jitter;
      await new Promise((r) => setTimeout(r, delay));
      attempt++;
    }
  }
}


