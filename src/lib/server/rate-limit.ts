export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

export function createRateLimiter(cfg: RateLimitConfig): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    check(key) {
      const now = Date.now();
      const cutoff = now - cfg.windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (recent.length >= cfg.max) {
        const retryAfterMs = Math.max(0, recent[0] + cfg.windowMs - now);
        hits.set(key, recent);
        return { ok: false, retryAfterMs };
      }
      recent.push(now);
      hits.set(key, recent);
      return { ok: true, retryAfterMs: 0 };
    }
  };
}
