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

  it("waits before declaring a link dead", () => {
    // The client parses the token out of the URL asynchronously, so a bare
    // getSession() can lose the race. Calling a working link expired is worse
    // than waiting a moment.
    expect(src).toMatch(/onAuthStateChange/);
    expect(src).toMatch(/setTimeout/);
  });

  it("explains an expired or reused link instead of showing an auth error", () => {
    expect(src).toMatch(/expired or has already been used/);
    // ...and offers the two real ways forward.
    expect(src).toMatch(/send you a new invitation/);
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
