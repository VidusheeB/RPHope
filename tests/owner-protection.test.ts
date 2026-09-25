import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the owner account cannot be deactivated from the portal", () => {
  const team = read("lib/reviewer/team.ts");

  it("the guard refuses an owner outright", () => {
    expect(team).toMatch(/if \(target\.is_owner\)/);
    expect(team).toMatch(/owner account and can't be deactivated/);
  });

  it("EVERY path that can set active=false goes through the same guard", () => {
    // There are two: the My Team buttons and the general-purpose
    // updateReviewerAction. The latter previously bypassed both the owner
    // rule and the last-admin rule entirely — a guard only one route honours
    // is not a guard.
    const memberActions = read("app/review/(dashboard)/admin/reviewers/actions.ts");
    const generalActions = read("app/review/actions.ts");
    expect(memberActions).toMatch(/checkDeactivationAllowed\(userId\)/);
    expect(generalActions).toMatch(/input\.active === false/);
    expect(generalActions).toMatch(/checkDeactivationAllowed\(input\.userId\)/);
  });

  it("the database refuses it too, not only the application", () => {
    // A protection that only exists in app code is bypassed by any direct
    // service-role call.
    const sql = read("supabase/migrations/0031_owner_account.sql");
    expect(sql).toMatch(/create trigger reviewer_profiles_protect_owner/);
    expect(sql).toMatch(/old\.active and not new\.active/);
    expect(sql).toMatch(/raise exception/);
  });

  it("lifting the protection is still possible, but only in SQL", () => {
    // Deliberately recoverable: clearing is_owner is allowed, so a tech person
    // can release the account. The trigger only blocks deactivating WHILE the
    // flag is set.
    const sql = read("supabase/migrations/0031_owner_account.sql");
    expect(sql).toMatch(/old\.is_owner and new\.is_owner/);
  });

  it("no application code ever writes is_owner", () => {
    // A protection the product can switch off is not a protection.
    for (const f of [
      "app/review/actions.ts",
      "app/review/(dashboard)/admin/reviewers/actions.ts",
      "components/review/TeamTable.tsx",
      "lib/reviewer/team.ts",
    ]) {
      expect(read(f)).not.toMatch(/is_owner:\s|update\([^)]*is_owner/);
    }
  });
});

describe("owner is a flag, not a role", () => {
  it("no third role was added to the clearance table", () => {
    // Owner grants nothing an admin lacks; it is a protection on one account.
    // A role would add a tier every future permission question has to reason
    // about, for no benefit.
    const perms = read("lib/reviewer/permissions.ts");
    expect(perms).toMatch(/export type ReviewerRole = "reviewer" \| "admin";/);
    // No "owner" role value, and no capability gated on being one. (The word
    // appears in prose about the product owner's decisions, which is why this
    // checks the model rather than the text.)
    expect(perms).not.toMatch(/"owner"/);
    expect(perms).not.toMatch(/is_owner/);
  });
});

describe("the roster is honest about it", () => {
  const table = read("components/review/TeamTable.tsx");

  it("marks the owner", () => {
    expect(table).toMatch(/Owner/);
  });

  it("does not offer an action that would always be refused", () => {
    expect(table).toMatch(/m\.isOwner/);
    expect(table).toMatch(/can't be deactivated from the portal/);
  });
});
