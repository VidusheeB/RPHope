// Capacity policy for the Realtime voice assistant.
//
// Context: OpenAI enforces its own limits on the account. When they are hit,
// POST /v1/realtime/calls returns 429 and the SDK — which expects an SDP answer
// — fails with a confusing "Failed to parse SessionDescription". Nothing here
// raises OpenAI's limit; the goal is to stay under it, fail politely when we
// don't, and stop holding capacity we aren't using.
//
// Three levers, in order of how much they actually help:
//
//  1. IDLE TIMEOUT (the big one). A 45-minute cap with no idle check means one
//     visitor who opens Hope and walks away holds an OpenAI realtime session
//     for 45 minutes. A handful of those can exhaust a small concurrency
//     allowance and lock everyone else out. Ending an unused session quickly
//     returns capacity — and stops holding a microphone open, which matters
//     here for its own reasons.
//  2. A GLOBAL START RATE CAP, so a burst of visitors (or one person testing)
//     cannot stampede the account into a 429.
//  3. The existing PER-CLIENT cap, which only stops a single abuser.

/** End a session after this long with no speech from either side. */
export const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

/** Warn the user this long before the idle timeout fires. */
export const IDLE_WARNING_MS = 30 * 1000;

/** Ceiling on NEW sessions started per minute across all visitors on this
 *  server instance. Best-effort (in-memory, per instance) — it blunts a
 *  stampede, it is not a distributed quota. */
export const GLOBAL_SESSION_STARTS_PER_MIN = 30;

/** True when a session has been silent long enough to release. */
export function isIdleExpired(lastActivityAt: number, now: number): boolean {
  return now - lastActivityAt >= IDLE_TIMEOUT_MS;
}

/** Milliseconds until the idle timeout, floored at zero. */
export function msUntilIdleTimeout(lastActivityAt: number, now: number): number {
  return Math.max(0, IDLE_TIMEOUT_MS - (now - lastActivityAt));
}

/** A 429 from OpenAI's realtime endpoint reaches the browser as an SDP parse
 *  failure, because the SDK feeds the JSON error body to setRemoteDescription.
 *  Recognising that shape lets the UI say "busy, wait a moment" instead of
 *  blaming the connection. */
export function isCapacityError(message: string): boolean {
  return /SessionDescription|Expect line|\b429\b|rate.?limit/i.test(message);
}
