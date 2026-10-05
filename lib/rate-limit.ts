/**
 * Fixed-window, in-memory rate limiter for the endpoints that spend money
 * (LLM calls, image uploads).
 *
 * State lives in the function instance, so on serverless this is best-effort:
 * each warm instance counts on its own. That is enough to stop a script from
 * hammering an endpoint through one connection — the realistic abuse case for a
 * small app — without adding a Redis dependency. For hard guarantees, put
 * Vercel Firewall rate limiting in front.
 */

interface Window {
  count: number
  resetAt: number
}

const windows = new Map<string, Window>()
const MAX_TRACKED_KEYS = 5_000

export interface RateLimitOptions {
  /** Max requests per window. */
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the window resets (for the Retry-After header). */
  retryAfter: number
}

export function rateLimit(key: string, { limit, windowMs }: RateLimitOptions, now = Date.now()): RateLimitResult {
  const current = windows.get(key)

  if (!current || current.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) pruneExpired(now)
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }

  current.count++
  return {
    allowed: current.count <= limit,
    retryAfter: Math.ceil((current.resetAt - now) / 1000),
  }
}

function pruneExpired(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key)
  }
  // Still full of live windows: drop the oldest entries rather than grow unbounded.
  for (const key of windows.keys()) {
    if (windows.size < MAX_TRACKED_KEYS) break
    windows.delete(key)
  }
}

/** Best available client identifier: the first hop of X-Forwarded-For (set by Vercel's proxy). */
export function clientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
}

/** Test hook. */
export function resetRateLimits(): void {
  windows.clear()
}
