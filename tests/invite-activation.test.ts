import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("activating an invitation", () => {
  const src = read("components/review/SetPasswordForm.tsx");

  it("checks for a session before offering the form", () => {
    // The form previously assumed a session existed. When one didn't —
    // expired link, already used, different browser — the only signal was a
    // raw "Auth session missing" AFTER the person had chosen and typed a
    // password twice.
    expect(src).toMatch(/getSession\(\)/);
    expect(src).toMatch(/sessionState/);
  });

  it("does not race the client — it reads the URL itself", () => {
    // An earlier version waited on onAuthStateChange and a timeout, hoping
    // the client would resolve the token. It never would: the client was
    // watching for a PKCE ?code= while the link carried hash tokens. Reading
    // the URL directly removes the race rather than widening it.
    expect(src).toMatch(/getSession\(\)/);
    expect(src).toMatch(/window\.location\.hash/);
    expect(src).not.toMatch(/onAuthStateChange/);
  });

  it("explains an expired or reused link instead of showing an auth error", () => {
    expect(src).toMatch(/This link has expired/);
    // ...and offers the two real ways forward: request a new link, or sign in
    // if a password already exists.
    expect(src).toMatch(/Request a new link/);
    expect(src).toMatch(/sign in/);
  });

  it("maps session-shaped update failures to the same plain explanation", () => {
    expect(src).toMatch(/session\|jwt\|token/);
  });

  it("announces failures to screen readers", () => {
    expect(src).toMatch(/role="alert"/);
  });
});

describe("recovering a stalled invitation", () => {
  it("Resend is available on the roster row, not only the member page", () => {
    // Links are single-use and time-limited, so the recovery action belongs
    // where "Invited" is actually visible.
    const table = read("components/review/TeamTable.tsx");
    expect(table).toMatch(/resendInvitationAction/);
    expect(table).toMatch(/m\.status === "invited"/);
  });

  it("resending is gated on team.manage server-side", () => {
    const actions = read("app/review/actions.ts");
    const body = actions.slice(actions.indexOf("export async function resendInvitationAction"));
    expect(body.slice(0, 400)).toMatch(/requireCapabilityService\("team\.manage"\)/);
  });
});

describe("the invite token is consumed explicitly, not by auto-detection", () => {
  const src = read("components/review/SetPasswordForm.tsx");

  it("handles hash tokens, which is how invite links actually arrive", () => {
    // Supabase delivers access_token + refresh_token in the hash (implicit
    // flow), while @supabase/ssr defaults to PKCE and watches for ?code=. A
    // brand-new link therefore produced no session, and the page announced it
    // as expired.
    expect(src).toMatch(/window\.location\.hash/);
    expect(src).toMatch(/access_token/);
    expect(src).toMatch(/refresh_token/);
    expect(src).toMatch(/setSession\(/);
  });

  it("also handles the PKCE shape, so neither configuration breaks it", () => {
    expect(src).toMatch(/exchangeCodeForSession/);
  });

  it("only Supabase's own error says 'expired' immediately", () => {
    // Everything else must fail to produce a session first. Declaring a
    // working link dead is worse than a moment of "checking".
    expect(src).toMatch(/hash\.get\("error"\)/);
  });

  it("clears the tokens out of the address bar once used", () => {
    // Otherwise a live session token sits in browser history, and in any
    // screenshot or bug report taken from that page.
    expect(src).toMatch(/history\.replaceState/);
  });
});
