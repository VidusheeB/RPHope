import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("conversation visibility is enforced by the database", () => {
  const lib = read("lib/reviewer/conversations.ts");

  it("reads conversations through the RLS-scoped client, not service-role", () => {
    // rt_select already says "your own, or everything if admin". Reading with
    // the cookie-bound client means a bug in this file cannot leak one
    // reviewer's thread to another — the database refuses first. Using
    // service-role here would silently make this file the only thing standing
    // between reviewers' private conversations.
    const getConversations = lib.slice(
      lib.indexOf("export async function getConversations"),
      lib.indexOf("export async function getConversation(")
    );
    expect(getConversations).toMatch(/getServerSupabase\(\)/);
    expect(getConversations).not.toMatch(/getServiceSupabase\(\)\s*\n?\s*\.from\("review_tickets"\)/);
  });

  it("does not re-implement the access rule as a WHERE clause", () => {
    // A second, divergent copy of an access rule eventually disagrees with the
    // first. RLS is the single source.
    const getConversations = lib.slice(
      lib.indexOf("export async function getConversations"),
      lib.indexOf("export async function getConversation(")
    );
    expect(getConversations).not.toMatch(/\.eq\("created_by"/);
  });

  it("only display names cross the service-role boundary", () => {
    // reviewer_profiles is admin-only under RLS, but a reviewer must still see
    // "Vidushee replied". Names are fine; email/role/permissions are not.
    const helper = lib.slice(lib.indexOf("async function displayNames"), lib.indexOf("export async function getConversations"));
    expect(helper).toMatch(/select\("user_id, display_name"\)/);
    for (const forbidden of ["email", "can_publish", "role"]) {
      expect(helper).not.toMatch(new RegExp(`select\\([^)]*${forbidden}`));
    }
  });
});

describe("internal notes stay internal", () => {
  const actions = read("app/review/(dashboard)/tickets/actions.ts");

  it("requires tickets.manage to write one", () => {
    expect(actions).toMatch(/internalNote && !can\(session\.profile, "tickets\.manage"\)/);
  });

  it("never notifies the conversation opener about an internal note", () => {
    // An internal note is admin-to-admin by definition; a notification would
    // leak both its existence and its subject line.
    const reply = actions.slice(actions.indexOf("export async function replyAction"), actions.indexOf("export async function updateConversationAction"));
    expect(reply).toMatch(/if \(!input\.internalNote\)/);
  });
});

describe("general conversations are representable", () => {
  it("draft_id is nullable and the insert policy allows a null", () => {
    const sql = read("supabase/migrations/0027_general_tickets.sql");
    expect(sql).toMatch(/alter column draft_id drop not null/);
    // The old policy gated on auth_is_assigned(draft_id), which is false for a
    // null draft — it would have rejected exactly the case being enabled.
    expect(sql).toMatch(/draft_id is null/);
  });

  it("filing still requires you to be yourself", () => {
    const sql = read("supabase/migrations/0027_general_tickets.sql");
    expect(sql).toMatch(/created_by = auth\.uid\(\)/);
  });
});

describe("ownership is a signal, not a lock", () => {
  it("assignment does not restrict who can read a conversation", () => {
    // Spec: an assigned conversation stays visible to every admin, so
    // "X is handling this" prevents duplicate replies without hiding work.
    const sql = read("supabase/migrations/0027_general_tickets.sql");
    expect(sql).not.toMatch(/assigned_admin = auth\.uid\(\)/);
  });

  it("opening a conversation never claims it", () => {
    // Claiming happens only through an explicit assign action.
    const page = read("app/review/(dashboard)/tickets/[id]/page.tsx");
    expect(page).not.toMatch(/assigned_admin/);
    expect(page).not.toMatch(/updateConversationAction/);
  });
});
