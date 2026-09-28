import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const sql = read("supabase/migrations/0033_fix_ticket_touch_recursion.sql");

describe("ticket updates no longer recurse", () => {
  it("the BEFORE trigger assigns to NEW instead of issuing an UPDATE", () => {
    // 0010 ran `update review_tickets ...` from inside review_tickets' own
    // BEFORE UPDATE trigger, so every update re-fired the trigger until
    // Postgres gave up with "stack depth limit exceeded". It meant NO ticket
    // could be resolved, delegated, or have its status changed.
    const fn = sql.slice(sql.indexOf("function public.touch_review_ticket"), sql.indexOf("drop trigger"));
    expect(fn).toMatch(/new\.updated_at := now\(\)/);
    expect(fn).not.toMatch(/update public\.review_tickets/);
  });

  it("a reply now touches its ticket, which never happened before", () => {
    // 0010 claimed to cover "reply-triggered" changes but attached nothing to
    // ticket_replies. The conversation list sorts by updated_at, so a thread
    // with a new reply never rose to the top.
    expect(sql).toMatch(/create trigger ticket_replies_touch_ticket/);
    expect(sql).toMatch(/after insert on ticket_replies/);
  });

  it("the reply trigger targets a DIFFERENT table, so it cannot recurse", () => {
    const fn = sql.slice(sql.indexOf("function public.touch_ticket_on_reply"));
    expect(fn).toMatch(/update public\.review_tickets/);
    expect(fn).toMatch(/where id = new\.ticket_id/);
  });
});

describe("database errors do not reach the person using the portal", () => {
  const actions = read("app/review/(dashboard)/tickets/actions.ts");

  it("raw Postgres text is never returned as the error message", () => {
    // "stack depth limit exceeded" was shown verbatim under the reply box.
    expect(actions).not.toMatch(/error: error\.message/);
    expect(actions).toMatch(/friendlyDbError/);
  });

  it("the real error still goes to the server log", () => {
    // Humanising it must not mean losing it.
    expect(actions).toMatch(/console\.error\("\[tickets\]"/);
  });
});

describe("gene rejections say why", () => {
  it("structured reasons are formatted, not stringified", () => {
    // RejectReason is { code, detail }; joining the array wrote
    // "[object Object]" into the database, destroying the only explanation of
    // why 11 genes were rejected.
    const route = read("app/api/genes/generation/drain/route.ts");
    expect(route).toMatch(/formatRejectReasons/);
    expect(route).not.toMatch(/result\.reasons\.join/);
  });

  it("a long list is capped rather than filling the queue row", () => {
    const route = read("app/api/genes/generation/drain/route.ts");
    expect(route).toMatch(/\.slice\(0, 3\)/);
    expect(route).toMatch(/\+\$\{reasons\.length - 3\} more/);
  });
});
