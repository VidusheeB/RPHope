// The hard product boundary between the public website and the Team Portal.
//
// One codebase serves two Vercel projects, distinguished only by
// NEXT_PUBLIC_REVIEW_APP_MODE:
//
//   rp-hope.org             (mode off) — the public RP Hope website, ONLY.
//   rphopereview.vercel.app (mode on)  — the internal Team Portal, ONLY.
//
// The portal used to be dual-homed: it answered at /review/* on the public
// site as well as at the bare paths on the portal domain. Authentication
// covered it, but an internal tool having a door on the public domain is a
// product boundary problem, not just an access one — so on the public
// deployment those paths now do not exist at all.
//
// The decision is a pure function so it can be unit-tested without
// constructing a NextRequest; middleware.ts is only the adapter around it.

/** Portal API routes that exist solely to serve the Team Portal. Public-site
 *  APIs (/api/tts, /api/trials/*, /api/stories/submit, …) are deliberately NOT
 *  listed — they belong to rp-hope.org and must keep working there. */
const PORTAL_API_PREFIXES = ["/api/genes/"];

export type PortalRouteDecision =
  /** Let the request through untouched. */
  | { kind: "pass" }
  /** Public deployment asked for something that only exists in the portal. */
  | { kind: "not-found" }
  /** Portal deployment: serve this bare path from its real /review/* route. */
  | { kind: "rewrite"; pathname: string };

function isPortalPage(pathname: string): boolean {
  return pathname === "/review" || pathname.startsWith("/review/");
}

function isPortalApi(pathname: string): boolean {
  return PORTAL_API_PREFIXES.some((p) => pathname.startsWith(p));
}

/**
 * What should happen to this request?
 *
 * @param pathname      the incoming path
 * @param reviewAppMode true on the Team Portal deployment
 */
export function routePortalRequest(pathname: string, reviewAppMode: boolean): PortalRouteDecision {
  if (!reviewAppMode) {
    // PUBLIC SITE. The portal is not merely protected here, it is absent —
    // including its API surface, so the boundary can't be stepped around by
    // calling an endpoint directly.
    if (isPortalPage(pathname) || isPortalApi(pathname)) return { kind: "not-found" };
    return { kind: "pass" };
  }

  // TEAM PORTAL. API routes keep their real paths in both modes (the client
  // fetches /api/... literally), so they must never be rewritten.
  if (pathname.startsWith("/api/")) return { kind: "pass" };

  // Already-canonical /review/* paths are served as-is, so both spellings
  // work on the portal domain and no rewrite loop is possible.
  if (isPortalPage(pathname)) return { kind: "pass" };

  // Everything else is a bare portal path: /genes -> /review/genes.
  return { kind: "rewrite", pathname: pathname === "/" ? "/review" : `/review${pathname}` };
}
