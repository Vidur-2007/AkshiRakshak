/**
 * In-memory sliding-window rate limiter per client IP (SPEC_A_ENGINE.md §12.6). Best effort:
 * each function instance keeps its own window, so limits are per instance, not global.
 */
import { apiError, clientIp } from './http.js';

export const LIMITS = {
  ai: 20,
  ask: 20,
  expand: 60,
  'domain-age': 60,
  reports: 60,
  analyze: 30,
} as const;
export type LimitName = keyof typeof LIMITS;
const WINDOW_MS = 60_000;
const MAX_KEYS = 10_000;

const hits = new Map<string, number[]>();

export function checkRate(
  name: LimitName,
  ip: string,
  now = Date.now(),
): { ok: true } | { ok: false; retryAfter: number } {
  const key = `${name}:${ip}`;
  const recent = (hits.get(key) ?? []).filter((t) => t > now - WINDOW_MS);
  if (recent.length >= LIMITS[name]) {
    hits.set(key, recent);
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil(((recent[0] ?? now) + WINDOW_MS - now) / 1000)),
    };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > MAX_KEYS) {
    for (const [k, v] of hits) if (!v.some((t) => t > now - WINDOW_MS)) hits.delete(k);
  }
  return { ok: true };
}

/** 429 response when the caller is over the limit, otherwise null. */
export function limited(name: LimitName, request: Request): Response | null {
  const r = checkRate(name, clientIp(request));
  return r.ok
    ? null
    : apiError(429, 'rate_limited', 'Too many requests, try again shortly', {
        'retry-after': String(r.retryAfter),
      });
}

/** Tests only. */
export function resetRateLimits(): void {
  hits.clear();
}
