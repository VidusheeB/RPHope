import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// vi.mock() calls are hoisted to the true top level of the module regardless
// of where they're textually written, so any variable they reference must
// also be declared at top level (see the working pattern in
// reviewer-atomic-publish.test.ts) — nesting them inside a describe() block
// leaves the referenced const out of scope at the hoisted call site.
const sessionMock = vi.fn();
vi.mock("@/lib/reviewer/session", () => ({ getReviewerSession: () => sessionMock() }));
vi.mock("@/lib/supabaseAdmin", () => ({ getServiceSupabase: () => null }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

beforeEach(() => sessionMock.mockReset());

describe("deactivated reviewers lose DATABASE access, not just app access (static)", () => {
  const sql = read("supabase/migrations/0013_active_reviewer_gate.sql");

  it("auth_is_assigned now also requires the assignee's reviewer_profiles.active", () => {
    const fn = sql.split("auth_is_assigned(d uuid)")[1].split("$$;")[0];
    expect(fn).toMatch(/reviewer_profiles/);
    expect(fn).toMatch(/p\.active/);
  });

  it("auth_is_active_assignee now also requires the assignee's reviewer_profiles.active", () => {
    const fn = sql.split("auth_is_active_assignee(d uuid)")[1].split("$$;")[0];
    expect(fn).toMatch(/reviewer_profiles/);
    expect(fn).toMatch(/p\.active/);
  });
});

describe("sign-out actually clears the session (static)", () => {
  it("SignOutButton calls Supabase auth.signOut() before redirecting to /review/login", () => {
    const src = read("components/review/SignOutButton.tsx");
    const signOutIdx = src.indexOf(".auth.signOut()");
    const redirectIdx = src.indexOf('"/review/login"');
    expect(signOutIdx).toBeGreaterThan(-1);
    expect(redirectIdx).toBeGreaterThan(-1);
    expect(signOutIdx).toBeLessThan(redirectIdx); // sign-out happens BEFORE the redirect
  });
});

describe("filing a ticket preserves unsaved review work (static)", () => {
  it("ReportIssueButton never navigates away or reloads the page on submit", () => {
    const src = read("components/review/ReportIssueButton.tsx");
    // window.location.href is read (to attach the current URL to the ticket)
    // but never assigned to, and there's no reload/router navigation call.
    expect(src).not.toMatch(/window\.location\s*=/);
    expect(src).not.toMatch(/window\.location\.(href\s*=|reload)/);
    expect(src).not.toMatch(/router\.(push|replace|refresh)/);
  });

  it("filing a ticket does not touch ReviewEditor's draft content/dirty state", () => {
    const src = read("components/review/ReviewEditor.tsx");
    // The only thing ReportIssueButton's onCreated callback does is
    // router.refresh() to reload the tickets list — it must not also clear
    // `content` or `dirty`, which would discard in-progress edits.
    const onCreatedLine = src.split("\n").find((l) => l.includes("onCreated={"));
    expect(onCreatedLine).toBeDefined();
    expect(onCreatedLine).not.toMatch(/setContent|setDirty/);
  });
});

describe("requestChangesAction — admin-only, note required", () => {
  it("rejects a non-admin", async () => {
    const { requestChangesAction } = await import("@/app/review/actions");
    sessionMock.mockResolvedValue({
      userId: "u2",
      email: "r@x.org",
      profile: { user_id: "u2", display_name: "R", role: "reviewer", can_publish: false, active: true },
    });
    const res = await requestChangesAction({ draftId: "d1", note: "fix the citation" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/admin/i);
  });

  it("rejects a missing/empty explanation even from an admin", async () => {
    const { requestChangesAction } = await import("@/app/review/actions");
    sessionMock.mockResolvedValue({
      userId: "u1",
      email: "a@x.org",
      profile: { user_id: "u1", display_name: "A", role: "admin", can_publish: true, active: true },
    });
    const res = await requestChangesAction({ draftId: "d1", note: "   " });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/explanation/i);
  });
});
