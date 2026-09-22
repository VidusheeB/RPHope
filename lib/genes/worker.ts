// Shared plumbing for triggering the generation worker.
//
// The worker is an ordinary HTTP route that this server calls on itself. That
// keeps generation entirely server-side — the browser only ever enqueues, so a
// run continues after the admin navigates away or closes the tab — without
// adding a queue service or a new dependency.

import { createHash } from "crypto";
import { portalOrigin } from "@/lib/portalOrigin";

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

/**
 * Absolute origin for a server-to-server call back into this app.
 *
 * Resolution order matters, and each step exists because of a real failure:
 *
 * 1. DEVELOPMENT resolves locally, never from NEXT_PUBLIC_SITE_URL: that
 *    variable legitimately points at the production site, so using it would
 *    make a local run fire its worker at production, where the job it is
 *    trying to drain does not exist.
 *
 * 2. The INCOMING REQUEST'S OWN HOST is preferred in production. This is the
 *    alias the admin actually loaded (rphopereview.vercel.app) and is
 *    therefore publicly reachable.
 *
 * 3. VERCEL_URL is a LAST RESORT, not a first choice. It is the
 *    deployment-specific hostname, which carries Vercel's Deployment
 *    Protection — a self-call to it lands on an SSO login wall rather than the
 *    worker route. That silently broke generation in production: jobs sat
 *    `queued` with attempts=0 forever, because the trigger fetch appeared to
 *    succeed while never reaching the route.
 */
function selfOrigin(): string | null {
  if (process.env.NODE_ENV !== "production") {
    return `http://localhost:${process.env.PORT ?? 3000}`;
  }
  const fromRequest = portalOrigin();
  if (fromRequest) return fromRequest;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return null;
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
  // invocation actually began — aborting too early can cancel it before the
  // platform starts the function — but short enough that we never block the
  // caller on a run that takes minutes.
  const timer = setTimeout(() => controller.abort(), 4000);
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
