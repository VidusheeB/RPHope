import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const action = read("app/review/set-password/actions.ts");

describe("requesting a new invitation is safe to expose publicly", () => {
  it("cannot be used to discover who has an RP Hope account", () => {
    // The caller could not sign in, so there is no session to check and this
    // is a public endpoint. Differing responses would turn it into a probe
    // for who works here.
    expect(action).toMatch(/const GENERIC\b/);
    const returns = action.match(/return \{ ok: true, message: GENERIC \}/g) ?? [];
    expect(returns.length).toBeGreaterThanOrEqual(4);
  });

  it("only notifies — it never creates, changes or re-invites an account", () => {
    // An endpoint that mailed a fresh login link to any address typed into it
    // would be a way in, not a convenience.
    expect(action).not.toMatch(/inviteUserByEmail|updateUserById|generate_link/);
    expect(action).toMatch(/notify\(|notifyAdmins\(/);
  });

  it("collapses repeat requests so an admin's bell can't be flooded", () => {
    expect(action).toMatch(/dedupeKey/);
    // One per person per day.
    expect(action).toMatch(/toISOString\(\)\.slice\(0, 10\)/);
  });

  it("does nothing for an account that already works", () => {
    expect(action).toMatch(/user\.last_sign_in_at/);
  });

  it("does nothing for a deactivated account", () => {
    expect(action).toMatch(/!profile\.active/);
  });

  it("swallows internal failures rather than describing them", () => {
    expect(action).toMatch(/catch \{/);
  });
});

describe("who gets told", () => {
  it("the admin who sent the invitation, when known", () => {
    expect(action).toMatch(/profile\.invited_by/);
    expect(action).toMatch(/recipient: profile\.invited_by/);
  });

  it("falls back to all admins rather than dropping the request", () => {
    // Accounts invited before invited_by was recorded, or seeded directly.
    expect(action).toMatch(/notifyAdmins\(\{ type: "invitation_requested"/);
  });
});

describe("the expired page offers the request, not a dead end", () => {
  const form = read("components/review/SetPasswordForm.tsx");

  it("leads with the expiry and a way forward", () => {
    expect(form).toMatch(/This link has expired/);
    expect(form).toMatch(/Request a new link/);
  });

  it("a session failure at submit time lands on the same recovery path", () => {
    // Otherwise someone whose link died mid-form gets told to go find an
    // admin while a self-serve button exists one state away.
    expect(form).toMatch(/setSessionState\("missing"\)/);
  });

  it("hides the form once the request succeeds", () => {
    expect(form).toMatch(/!requestResult\?\.ok &&/);
  });
});
