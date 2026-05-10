import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRateLimiter } from '../../src/lib/server/rate-limit';

describe('rate-limiter', () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));

  it('allows up to max attempts in the window', () => {
    const rl = createRateLimiter({ max: 3, windowMs: 60_000 });
    expect(rl.check('1.2.3.4').ok).toBe(true);
    expect(rl.check('1.2.3.4').ok).toBe(true);
    expect(rl.check('1.2.3.4').ok).toBe(true);
    expect(rl.check('1.2.3.4').ok).toBe(false);
  });

  it('returns retryAfterMs when blocked', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 60_000 });
    rl.check('x');
    const r = rl.check('x');
    expect(r.ok).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
    expect(r.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it('resets after window passes', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 60_000 });
    rl.check('y');
    expect(rl.check('y').ok).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(rl.check('y').ok).toBe(true);
  });

  it('tracks per-IP independently', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 60_000 });
    rl.check('a');
    expect(rl.check('a').ok).toBe(false);
    expect(rl.check('b').ok).toBe(true);
  });
});
