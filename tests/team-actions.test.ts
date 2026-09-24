import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveStatus } from "@/lib/reviewer/team";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("deactivation is always reversible", () => {
  it("there is no removed state anywhere in the team model", () => {
    // Permanent removal was dropped as a product decision. Leaving the state
    // half-implemented is how `removed_at` ended up being SELECTed from a
    // column no migration created.
    const team = read("lib/reviewer/team.ts");
    const actions = read("app/review/(dashboard)/admin/reviewers/actions.ts");
    const table = read("components/review/TeamTable.tsx");
    for (const src of [team, actions, table]) {
      expect(src).not.toMatch(/removed_at/);
      expect(src).not.toMatch(/removeMemberAction/);
    }
  });

  it("reactivate does not depend on any column beyond `active`", () => {
    // The bug: reactivate selected removed_at, the query failed, and the admin
    // was told "that team member no longer exists" about someone plainly
    // listed on screen.
    const actions = read("app/review/(dashboard)/admin/reviewers/actions.ts");
    const body = actions.slice(actions.indexOf("export async function reactivateMemberAction"));
    expect(body).toMatch(/update\(\{ active: true \}\)/);
    expect(body).not.toMatch(/\.select\(/);
  });

  it("a failed lookup is not reported as a missing person", () => {
    // Checking `data` without `error` turns any query failure into a
    // confident, wrong statement about the wrong thing.
    const actions = read("app/review/(dashboard)/admin/reviewers/actions.ts");
    expect(actions).toMatch(/error: lookupError/);
    expect(actions).toMatch(/if \(lookupError\) return/);
  });
});

describe("deriveStatus", () => {
  it("an account with no password set reads as invited", () => {
    expect(deriveStatus({ active: true, hasActivated: false })).toBe("invited");
  });

  it("an activated account reads as active", () => {
    expect(deriveStatus({ active: true, hasActivated: true })).toBe("active");
  });

  it("inactive beats invited — access is what matters, not acceptance", () => {
    // Someone deactivated before ever activating is inactive, not "invited":
    // showing "invited" would suggest they just need to click their link.
    expect(deriveStatus({ active: false, hasActivated: false })).toBe("inactive");
    expect(deriveStatus({ active: false, hasActivated: true })).toBe("inactive");
  });

  it("status never derives from sign-in time", () => {
    // Opening an invitation link verifies the token and signs the person in,
    // so last_sign_in_at goes true the moment they open the email. Using it
    // made everyone read as Active the instant they were invited, while they
    // still had no password and could not sign in at all.
    const team = read("lib/reviewer/team.ts");
    expect(team).not.toMatch(/hasSignedIn/);
    expect(team).toMatch(/activated_at/);
  });
});
