import { NextResponse, type NextRequest } from "next/server";
import { routePortalRequest } from "@/lib/reviewer/portalBoundary";

// Adapter around the portal boundary. The decision itself lives in
// lib/reviewer/portalBoundary.ts so it can be unit-tested; see that file for
// why the public site and the Team Portal are hard-separated.
//
// Internal portal links must be generated via lib/reviewer/paths.ts's
// reviewHref() so they match whichever mode is live — this middleware only
// handles the incoming-request side of that split.
const REVIEW_APP_MODE = process.env.NEXT_PUBLIC_REVIEW_APP_MODE === "1";

/** Rewriting to a path no route matches makes Next render its not-found page
 *  with a real 404 — so rp-hope.org/review looks exactly like any other
 *  mistyped URL, rather than hinting that something exists but is protected. */
const NOT_FOUND_PATH = "/_portal-not-found";

export function middleware(request: NextRequest) {
  const decision = routePortalRequest(request.nextUrl.pathname, REVIEW_APP_MODE);

  if (decision.kind === "pass") return NextResponse.next();

  const target = request.nextUrl.clone();
  target.pathname = decision.kind === "not-found" ? NOT_FOUND_PATH : decision.pathname;
  return NextResponse.rewrite(target);
}

export const config = {
  matcher: [
    // Everything except Next internals and the API surface...
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
    // ...plus the portal-only API routes, which must also be absent from the
    // public deployment. Public-site APIs stay excluded by the pattern above.
    "/api/genes/:path*",
  ],
};
