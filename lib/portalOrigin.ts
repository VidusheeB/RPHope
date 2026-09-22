// The origin of the request currently being served.
//
// WHY NOT NEXT_PUBLIC_SITE_URL
// ----------------------------
// Anything emailed to a person — an invitation, a password reset — must point
// at the deployment they will actually open. NEXT_PUBLIC_SITE_URL cannot do
// that job: it is a single build-time value, it legitimately points at the
// PUBLIC website rather than the Team Portal, and when it is set to a local
// value (as it is in .env.local) every invitation goes out pointing at
// http://localhost:3000 — unreachable for the recipient, and the link looks
// broken rather than expired.
//
// Reading the incoming host instead means an invitation sent from
// rphopereview.vercel.app links back to rphopereview.vercel.app, one sent from
// localhost links to localhost, and nobody has to keep an env var in sync with
// which deployment is live.

import { headers } from "next/headers";

/**
 * Absolute origin (scheme + host) of the current request, or null when called
 * outside a request scope and no fallback is configured.
 *
 * Safe in server actions and route handlers. Prefers x-forwarded-* because
 * that is what a proxy/CDN sets to the host the browser really used; `host`
 * alone can be an internal address.
 */
export function portalOrigin(): string | null {
  try {
    const h = headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    if (host) {
      const forwardedProto = h.get("x-forwarded-proto");
      // Local development is plain http; everything else is https. Guessing
      // https for localhost produces a link that refuses to connect.
      const proto =
        forwardedProto ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // Not inside a request (e.g. a script) — fall through.
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? null;
}
