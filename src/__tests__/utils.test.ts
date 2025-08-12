import { formatTime, calculateTimeLeft } from '../utils/time';
import { throttle } from '../utils/throttle';
import { createRateLimiter } from '../utils/rateLimit';

describe('time utils', () => {
  it('formatTime formats hh:mm:ss', () => {
    expect(formatTime(0)).toBe('00:00:00');
    expect(formatTime(999)).toBe('00:00:00');
    expect(formatTime(1000)).toBe('00:00:01');
    expect(formatTime(61_000)).toBe('00:01:01');
    expect(formatTime(3_600_000)).toBe('01:00:00');
  });

  it('calculateTimeLeft returns non-negative', () => {
    const now = Date.now();
    expect(calculateTimeLeft(now - 1000)).toBe(0);
    const left = calculateTimeLeft(now + 1500);
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(1500);
  });
});

describe('throttle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('limits calls to at most once per window', () => {
    const calls: number[] = [];
    const fn = throttle(() => calls.push(Date.now()), 200);
    fn();
    fn();
    fn();
    expect(calls.length).toBe(1);
    jest.advanceTimersByTime(210);
    fn();
    expect(calls.length).toBe(2);
  });
});

describe('createRateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('enforces min delay and max per minute', () => {
    const allow = createRateLimiter(2, 100);
    expect(allow()).toBe(true);
    // immediate second call blocked due to min delay
    expect(allow()).toBe(false);
    jest.advanceTimersByTime(110);
    expect(allow()).toBe(true);
    // third within a minute blocked by cap
    jest.advanceTimersByTime(110);
    expect(allow()).toBe(false);
    // after a minute the counter decays
    jest.advanceTimersByTime(60_000);
    expect(allow()).toBe(true);
  });
});


