import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("audit fix #1 — review_status/workflow columns can't be forged via a direct request (static)", () => {
  const sql = read("supabase/migrations/0019_workflow_column_guard.sql");

  it("adds a BEFORE UPDATE trigger on gene_page_drafts (RLS alone can't restrict column values)", () => {
    expect(sql).toMatch(/create trigger gpd_workflow_columns_guard/);
    expect(sql).toMatch(/before update on gene_page_drafts/);
  });

  it("allows service_role and admins through, blocks everyone else from changing review_status or workflow actor/timestamp columns", () => {
    expect(sql).toMatch(/current_user = 'service_role' or public\.auth_is_admin\(\)/);
    for (const col of ["review_status", "submitted_at", "submitted_by", "reviewed_at", "reviewed_by", "changes_requested_at", "changes_requested_by"]) {
      expect(sql).toContain(`new.${col} is distinct from old.${col}`);
    }
    expect(sql).toMatch(/raise exception/);
  });

  it("does NOT guard first_opened_at/last_activity_at — those are legitimately reviewer-set", () => {
    expect(sql).not.toContain("new.first_opened_at is distinct from old.first_opened_at");
    expect(sql).not.toContain("new.last_activity_at is distinct from old.last_activity_at");
  });
});

describe("audit fix #2 — deactivated reviewers lose ticket read/reply access too (static)", () => {
  const sql = read("supabase/migrations/0020_ticket_active_reviewer_gate.sql");

  it("adds an auth_is_active_reviewer() helper, restricted to authenticated", () => {
    expect(sql).toMatch(/function public\.auth_is_active_reviewer\(\)/);
    expect(sql).toMatch(/revoke execute on function public\.auth_is_active_reviewer\(\) from public/);
    expect(sql).toMatch(/grant execute on function public\.auth_is_active_reviewer\(\) to authenticated/);
  });

  it("rt_select and trep_select/trep_insert now require the caller to still be active, not just the original filer", () => {
    expect(sql).toMatch(/create policy rt_select on review_tickets[\s\S]*auth_is_active_reviewer\(\)/);
    expect(sql).toMatch(/create policy trep_select on ticket_replies[\s\S]*auth_is_active_reviewer\(\)/);
    expect(sql).toMatch(/create policy trep_insert on ticket_replies[\s\S]*auth_is_active_reviewer\(\)/);
  });
});

// ---- Server-action authorization: non-admin blocked before any privileged write ----

const sessionMock = vi.fn();
vi.mock("@/lib/reviewer/session", () => ({ getReviewerSession: () => sessionMock() }));
const serviceMock = vi.fn();
vi.mock("@/lib/supabaseAdmin", () => ({ getServiceSupabase: () => serviceMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { approveReviewAction, unpublishGeneAction, restoreVersionAction, saveAdminNoteAction } from "@/app/review/actions";

const reviewerSession = {
  userId: "r1",
  email: "r@x.org",
  profile: { user_id: "r1", display_name: "R", role: "reviewer" as const, can_publish: false, active: true },
};

beforeEach(() => {
  sessionMock.mockReset();
  serviceMock.mockReset();
  sessionMock.mockResolvedValue(reviewerSession);
});

describe("new Phase-1 admin actions each re-check admin status server-side", () => {
  it("approveReviewAction rejects a reviewer before touching the database", async () => {
    const res = await approveReviewAction("d1");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/admin/i);
    expect(serviceMock).not.toHaveBeenCalled();
  });

  it("unpublishGeneAction rejects a reviewer (even one with can_publish would still need admin role)", async () => {
    const res = await unpublishGeneAction("rpgr");
    expect(res.ok).toBe(false);
    expect(serviceMock).not.toHaveBeenCalled();
  });

  it("restoreVersionAction rejects a reviewer before touching the database", async () => {
    const res = await restoreVersionAction("v1");
    expect(res.ok).toBe(false);
    expect(serviceMock).not.toHaveBeenCalled();
  });

  it("saveAdminNoteAction rejects a reviewer before touching the database", async () => {
    const res = await saveAdminNoteAction("d1", "note");
    expect(res.ok).toBe(false);
    expect(serviceMock).not.toHaveBeenCalled();
  });
});
