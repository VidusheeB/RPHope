// Minimal, no-dependency, in-memory rate limiter for the voice API routes.
// Prototype-grade: state lives per server instance, so it is best-effort under
// horizontal scaling (documented in VOICE_ASSISTANT_SETUP.md). Enough to blunt
// obvious abuse of the token and expert endpoints.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: boolean; retryAfterSec?: number };

export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }
  if (bucket.count >= opts.limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count += 1;
  return { ok: true };
}

/** Best-effort client identifier from proxy headers (no PII stored). */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Opportunistic cleanup so the map can't grow unbounded on a long-lived instance.
export function sweepExpired(): void {
  const now = Date.now();
  const expired: string[] = [];
  buckets.forEach((b, k) => {
    if (now > b.resetAt) expired.push(k);
  });
  expired.forEach((k) => buckets.delete(k));
}
