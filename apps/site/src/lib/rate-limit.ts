import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

/**
 * Rate limiter for /r/[code] (Phase 04, T07; spec § 5 step 8): per-IP 60/min +
 * per-code 300/min, sliding window, via Upstash Ratelimit (survives multi-
 * instance deploys).
 *
 * GRACEFUL DEGRADATION (autopilot KEY reminder): when RATE_LIMIT_ENABLED is
 * 'false' (local-dev default) OR the Upstash env vars are absent OR a limiter
 * call throws, this NO-OPS (allows the request) and logs a warning — it MUST
 * NEVER crash the redirect path just because Redis is unavailable.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

type Limiters = { ipLimiter: Ratelimit; codeLimiter: Ratelimit } | null;

let _limiters: Limiters | undefined; // undefined = not yet initialized; null = disabled

function getLimiters(): Limiters {
  if (_limiters !== undefined) {
    return _limiters;
  }
  const enabled = process.env.RATE_LIMIT_ENABLED !== 'false';
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!enabled || !url || !token) {
    if (process.env.RATE_LIMIT_ENABLED !== 'false') {
      console.warn(
        '[rate-limit] Upstash not configured (UPSTASH_REDIS_REST_URL/TOKEN missing) — rate limiting DISABLED (no-op).',
      );
    }
    _limiters = null;
    return _limiters;
  }
  const redis = new Redis({ url, token });
  _limiters = {
    ipLimiter: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      prefix: 'rl:ip',
    }),
    codeLimiter: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(300, '1 m'),
      prefix: 'rl:code',
    }),
  };
  return _limiters;
}

export async function checkRateLimit(ip: string, code: string): Promise<RateLimitResult> {
  const limiters = getLimiters();
  if (!limiters) {
    return { allowed: true }; // disabled / not configured → no-op
  }
  try {
    const [ipResult, codeResult] = await Promise.all([
      limiters.ipLimiter.limit(ip),
      limiters.codeLimiter.limit(code),
    ]);
    if (!ipResult.success || !codeResult.success) {
      const reset = Math.max(ipResult.reset, codeResult.reset);
      const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      return { allowed: false, retryAfter };
    }
    return { allowed: true };
  } catch (err) {
    // Redis unreachable / transient error → fail OPEN (allow), never crash redirect.
    console.warn('[rate-limit] limiter error — allowing request (fail-open):', err);
    return { allowed: true };
  }
}
