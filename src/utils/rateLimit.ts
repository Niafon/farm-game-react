export function createRateLimiter(maxPerMinute: number, minDelayMs: number) {
  let actionCount = 0;
  let lastActionTime = 0;
  return function allow(): boolean {
    const now = Date.now();
    if (now - lastActionTime < minDelayMs) return false;
    if (actionCount >= maxPerMinute) return false;
    lastActionTime = now;
    actionCount++;
    setTimeout(() => actionCount--, 60000);
    return true;
  };
}

