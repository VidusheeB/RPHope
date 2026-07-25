import { NextResponse, type NextRequest } from "next/server";

// On rphopereview.vercel.app (NEXT_PUBLIC_REVIEW_APP_MODE=1), the reviewer
// portal IS the whole site — every top-level path is transparently rewritten
// to its real /review/* route (server-side only; the browser's address bar
// keeps showing the clean, prefix-free path). rp-hope.vercel.app runs the
// same build WITHOUT that env var, so this middleware no-ops there and
// /review/* keeps working exactly as it always has.
//
// Internal review-app links must be generated via lib/reviewer/paths.ts's
// reviewHref() so they match whichever mode is actually live — this
// middleware only handles the incoming-request side of that split.
const REVIEW_APP_MODE = process.env.NEXT_PUBLIC_REVIEW_APP_MODE === "1";

export function middleware(request: NextRequest) {
  if (!REVIEW_APP_MODE) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/review")) return NextResponse.next();

  const target = request.nextUrl.clone();
  target.pathname = pathname === "/" ? "/review" : `/review${pathname}`;
  return NextResponse.rewrite(target);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
