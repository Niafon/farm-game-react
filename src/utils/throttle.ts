export function throttle<T extends (...args: unknown[]) => void>(fn: T, wait: number): T {
  let lastTime = 0;
  let timeout: number | null = null;
  let lastArgs: unknown[] | null = null;
  const invoke = () => {
    lastTime = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    fn.apply(null as unknown as ThisParameterType<T>, lastArgs! as Parameters<T>);
    timeout = null;
    lastArgs = null;
  };
  return ((...args: unknown[]) => {
    const now = Date.now();
    const remaining = wait - (now - lastTime);
    lastArgs = args;
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      invoke();
    } else if (!timeout) {
      timeout = window.setTimeout(invoke, remaining);
    }
  }) as unknown as T;
}

