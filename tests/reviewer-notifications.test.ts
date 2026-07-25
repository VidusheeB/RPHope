import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("notifications — RLS guarantees (static)", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/0011_notifications.sql"), "utf8");

  it("a user can only select their own notifications — no admin bypass", () => {
    expect(sql).toMatch(/notif_select_own[\s\S]*for select using \(recipient = auth\.uid\(\)\)/);
  });

  it("a user can only mark their own notifications read", () => {
    expect(sql).toMatch(
      /notif_update_own[\s\S]*for update using \(recipient = auth\.uid\(\)\) with check \(recipient = auth\.uid\(\)\)/
    );
  });

  it("has no insert policy for authenticated users — writes are service-role only", () => {
    expect(sql).not.toMatch(/for insert/);
  });
});
