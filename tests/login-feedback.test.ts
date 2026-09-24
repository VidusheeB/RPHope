import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(process.cwd(), "components/review/LoginForm.tsx"), "utf8");

describe("a locked-out person is told why", () => {
  it("checks portal access after authenticating, not just credentials", () => {
    // Supabase auth and portal access are separate gates: a deactivated person
    // still has valid credentials, so sign-in succeeds and requireReviewer()
    // then bounces them back to login forever with no explanation.
    expect(src).toMatch(/reviewer_profiles/);
    expect(src).toMatch(/profile\.active/);
  });

  it("names deactivation explicitly and says what to do about it", () => {
    expect(src).toMatch(/deactivated/i);
    expect(src).toMatch(/reactivate/i);
  });

  it("only selects columns that actually exist", () => {
    // A near-miss worth pinning: an earlier version selected `removed_at`, a
    // column no migration ever created. The query would have failed for EVERY
    // user, and the code would have concluded "this account isn't set up for
    // the portal" — locking the whole team out of the portal at once.
    const select = src.match(/\.select\("([^"]+)"\)/);
    expect(select).not.toBeNull();
    expect(select![1].split(",").map((c) => c.trim())).toEqual(["active"]);
  });

  it("signs out on every refusal so no half-session is left behind", () => {
    // Otherwise the auth cookie exists, every page redirects to login, and it
    // looks like the sign-in button is broken.
    const refusals = src.match(/await supabase\.auth\.signOut\(\)/g) ?? [];
    expect(refusals.length).toBeGreaterThanOrEqual(2);
  });

  it("does NOT reveal whether an email has an account", () => {
    // User enumeration: distinguishing "no such user" from "wrong password"
    // lets anyone test who works at RP Hope. The remedy is identical anyway.
    expect(src).toMatch(/email and password don't match/i);
    expect(src).not.toMatch(/no account with that email|user not found/i);
  });

  it("announces failures to screen readers immediately", () => {
    expect(src).toMatch(/role=\{problem\.kind === "error" \? "alert" : "status"\}/);
  });
});
