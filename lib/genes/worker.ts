// Shared plumbing for triggering the generation worker.
//
// The worker is an ordinary HTTP route that this server calls on itself. That
// keeps generation entirely server-side — the browser only ever enqueues, so a
// run continues after the admin navigates away or closes the tab — without
// adding a queue service or a new dependency.

import { createHash } from "crypto";

/**
 * Shared secret for the worker route.
 *
 * Deliberately derived from server-only material already present rather than
 * requiring a new env var to be set before the feature works: a missing secret
 * during a demo would mean a silently dead queue. Prefers an explicit
 * CRON_SECRET when one exists.
 *
 * Never send this to the browser. It is only ever a server-to-server header.
 */
export function workerSecret(): string | null {
  const explicit = process.env.CRON_SECRET;
  if (explicit) return explicit;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  // Hashed so the service-role key itself is never the header value.
  return createHash("sha256").update(`rp-hope-generation-worker:${serviceKey}`).digest("hex");
}

/** Absolute origin for a server-to-server call back into this app. */
function selfOrigin(): string | null {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  return "http://localhost:3000";
}

/**
 * Kick the worker without waiting for it to finish.
 *
 * We intentionally do NOT await the full response: the worker runs for
 * minutes, and the caller (an enqueue action, or a page load noticing pending
 * work) must return immediately. We DO await the dispatch briefly so the
 * request is guaranteed to have reached the server and started its own
 * invocation, which then proceeds independently of this one.
 *
 * Failures are swallowed on purpose — a missed kick is self-healing, because
 * the next page load or status poll notices pending work and kicks again.
 */
export async function triggerGenerationWorker(): Promise<void> {
  const secret = workerSecret();
  const origin = selfOrigin();
  if (!secret || !origin) return;

  const controller = new AbortController();
  // Long enough to be certain the request was accepted and the worker
  // invocation began; short enough that we never block the caller on the run.
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    await fetch(`${origin}/api/genes/generation/drain`, {
      method: "POST",
      headers: { "x-worker-secret": secret },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    // AbortError is the expected path: the worker is still running, we just
    // stopped listening. Anything else is retried by the next kick.
  } finally {
    clearTimeout(timer);
  }
}
