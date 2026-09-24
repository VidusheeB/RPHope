import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { threadLabel } from "@/lib/reviewer/messages";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("messages are private — admins included", () => {
  const sql = read("supabase/migrations/0029_direct_messages.sql");
  // Strip SQL comments — the file legitimately DISCUSSES auth_is_admin when
  // explaining why there is no admin override.
  const statements = sql.replace(/^\s*--.*$/gm, "");

  it("no policy grants an admin override", () => {
    // This is the load-bearing difference from tickets, where every admin can
    // see everything. Being an administrator of the organisation must not make
    // you a reader of its private correspondence.
    expect(statements).not.toMatch(/auth_is_admin/);
  });

  it("every table is participant-scoped", () => {
    for (const t of ["conversations", "conversation_participants", "conversation_messages"]) {
      expect(sql).toMatch(new RegExp(`alter table ${t}\\s+enable row level security`));
    }
    expect(sql).toMatch(/create policy conv_select on conversations\s+for select using \(auth_in_conversation\(id\)\)/);
    expect(sql).toMatch(/create policy convm_select on conversation_messages\s+for select using \(auth_in_conversation\(conversation_id\)\)/);
  });

  it("the participation check is SECURITY DEFINER to avoid RLS recursion", () => {
    // "You may read a participant row if you are a participant" has to query
    // the same table to decide, which re-triggers the policy and fails with
    // infinite recursion. A definer function breaks the cycle.
    expect(sql).toMatch(/function public\.auth_in_conversation[\s\S]*?security definer/);
    // It takes auth.uid() internally, so it cannot be used to probe anyone
    // else's membership.
    expect(sql).toMatch(/p\.user_id = auth\.uid\(\)/);
  });

  it("you can only post as yourself, into a thread you are in", () => {
    expect(sql).toMatch(/author = auth\.uid\(\) and auth_in_conversation\(conversation_id\)/);
  });

  it("you can remove only your own participation", () => {
    expect(sql).toMatch(/create policy convp_delete[\s\S]*?using \(user_id = auth\.uid\(\)\)/);
  });

  it("messages are immutable — no update or delete policy", () => {
    // Silently rewriting what you said after someone read it is not a property
    // of a message thread.
    expect(sql).not.toMatch(/create policy convm_update/);
    expect(sql).not.toMatch(/create policy convm_delete/);
  });
});

describe("message reads never use service-role", () => {
  const lib = read("lib/reviewer/messages.ts");

  it("thread and message reads go through the RLS-scoped client", () => {
    for (const fn of ["getThreads", "getThread"]) {
      const start = lib.indexOf(`export async function ${fn}`);
      const body = lib.slice(start, start + 2200);
      expect(body).toMatch(/getServerSupabase\(\)/);
      expect(body).not.toMatch(/getServiceSupabase/);
    }
  });

  it("only display names cross the service-role boundary", () => {
    // threadLabel now lives in messageModel.ts (pure, client-safe), so slice
    // to the next declaration instead of to it.
    const start = lib.indexOf("async function displayNames");
    const helper = lib.slice(start, lib.indexOf("export async function getThreads"));
    expect(helper).toMatch(/select\("user_id, display_name"\)/);
    expect(helper).not.toMatch(/body|conversation_messages/);
  });
});

describe("anyone can message anyone", () => {
  it("the recipient list is not filtered by role", () => {
    // Any team member to any team member, including future roles.
    const lib = read("lib/reviewer/messages.ts");
    const body = lib.slice(lib.indexOf("export async function getMessageableMembers"));
    expect(body).toMatch(/\.eq\("active", true\)/);
    expect(body).not.toMatch(/\.eq\("role"/);
  });

  it("both roles hold messages.send", () => {
    const perms = read("lib/reviewer/permissions.ts");
    const reviewer = perms.slice(perms.indexOf("reviewer: ["), perms.indexOf("admin: ["));
    const admin = perms.slice(perms.indexOf("admin: ["));
    expect(reviewer).toMatch(/"messages\.send"/);
    expect(admin).toMatch(/"messages\.send"/);
  });
});

describe("threadLabel", () => {
  const p = (n: string) => ({ userId: n, displayName: n });

  it("a titled group uses its title", () => {
    expect(threadLabel([p("Ann"), p("Bo")], "Gene team")).toBe("Gene team");
  });

  it("a 1:1 is named by the other person", () => {
    expect(threadLabel([p("Ann")], null)).toBe("Ann");
  });

  it("two people are joined with 'and'", () => {
    expect(threadLabel([p("Ann"), p("Bo")], null)).toBe("Ann and Bo");
  });

  it("larger groups summarise rather than run off the row", () => {
    expect(threadLabel([p("Ann"), p("Bo"), p("Cy"), p("Di")], null)).toBe("Ann, Bo and 2 more");
  });

  it("a blank title falls back to participants rather than showing empty", () => {
    expect(threadLabel([p("Ann")], "   ")).toBe("Ann");
  });
});
