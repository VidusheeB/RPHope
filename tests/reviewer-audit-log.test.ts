import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("audit_log — RLS guarantees (static)", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0012_audit_log.sql"), "utf8");

  it("enables RLS on audit_log", () => {
    expect(sql).toMatch(/alter table audit_log enable row level security/);
  });

  it("defines NO select/insert/update policy — deny-all for anon/authenticated, service-role only", () => {
    expect(sql).not.toMatch(/create policy/);
  });
});
