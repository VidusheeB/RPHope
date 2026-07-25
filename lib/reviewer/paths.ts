// The reviewer/admin portal lives at /review/* on the main public site
// (rp-hope.vercel.app/review — kept live deliberately, e.g. for demos), but
// also runs as its OWN top-level app on a separate domain
// (rphopereview.vercel.app), where every /review/* path is reachable at its
// bare, prefix-free equivalent instead (middleware.ts rewrites incoming
// requests there — see that file for the server side of this).
//
// Every internal Link href / redirect() / router.push / revalidatePath
// inside the reviewer portal must go through this helper rather than
// hardcoding "/review/..." — that's what lets the exact same code serve
// clean URLs on rphopereview.vercel.app while /review/* keeps working
// unchanged on rp-hope.vercel.app.
//
// NEXT_PUBLIC_ so it's readable both server-side (redirect, revalidatePath)
// and client-side (Link, router.push) from the same inlined build-time value.
export const REVIEW_APP_MODE = process.env.NEXT_PUBLIC_REVIEW_APP_MODE === "1";

/** path must start with "/" (or be "" for the review home). */
export function reviewHref(path: string): string {
  if (REVIEW_APP_MODE) return path === "" ? "/" : path;
  return `/review${path}`;
}

/** In REVIEW_APP_MODE, "/" and every other non-review path are middleware-
 *  rewritten to the review app, so a link to public-site content (e.g. the
 *  "Genetic Insights" / "Public site" links in the header) has to leave the
 *  domain entirely rather than resolve locally. Outside REVIEW_APP_MODE
 *  (i.e. on rp-hope.vercel.app itself), it's just a normal relative link. */
export function publicHref(path: string): string {
  return REVIEW_APP_MODE ? `https://rp-hope.vercel.app${path}` : path;
}
