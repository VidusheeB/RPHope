import { describe, it, expect, vi, beforeEach } from "vitest";

const sessionMock = vi.fn();
vi.mock("@/lib/reviewer/session", () => ({ getReviewerSession: () => sessionMock() }));

const serviceMock = vi.fn();
vi.mock("@/lib/supabaseAdmin", () => ({ getServiceSupabase: () => serviceMock() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { assignDraftAction } from "@/app/review/actions";

beforeEach(() => {
  sessionMock.mockReset();
  serviceMock.mockReset();
  sessionMock.mockResolvedValue({
    userId: "admin-1",
    email: "admin@x.org",
    profile: { user_id: "admin-1", display_name: "Admin", role: "admin", can_publish: true, active: true },
  });
});

/** Minimal chainable double covering exactly the calls assignDraftAction makes. */
function makeService(opts: {
  firstOpenedAt: string | null;
  currentActive: { id: string; reviewer_id: string; status: string }[];
}) {
  const updates: { table: string; patch: unknown; matchId?: string }[] = [];
  const inserts: { table: string; row: unknown }[] = [];

  const draftsBuilder = {
    select: () => draftsBuilder,
    eq: () => draftsBuilder,
    maybeSingle: () =>
      Promise.resolve({ data: { gene_symbol: "RPGR", first_opened_at: opts.firstOpenedAt } }),
  };

  function assignmentsBuilder() {
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      not: () => Promise.resolve({ data: opts.currentActive }),
      update: (patch: unknown) => ({
        eq: (_col: string, value: string) => {
          updates.push({ table: "draft_assignments", patch, matchId: value });
          return Promise.resolve({ error: null });
        },
      }),
      upsert: (row: unknown) => {
        inserts.push({ table: "draft_assignments", row });
        return Promise.resolve({ error: null });
      },
    };
    return b;
  }

  return {
    _updates: updates,
    _inserts: inserts,
    from: (table: string) => {
      if (table === "gene_page_drafts") return draftsBuilder;
      if (table === "draft_assignments") return assignmentsBuilder();
      if (table === "reviewer_profiles") return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) };
      return { select: () => ({ eq: () => Promise.resolve({ data: [] }) }) };
    },
  };
}

describe("assignDraftAction — first-time assignment", () => {
  it("assigns cleanly with no prior assignee, no confirmation needed", async () => {
    const service = makeService({ firstOpenedAt: null, currentActive: [] });
    serviceMock.mockReturnValue(service);
    const res = await assignDraftAction({ draftId: "d1", reviewerId: "rev-1" });
    expect(res.ok).toBe(true);
    expect(service._inserts).toHaveLength(1);
  });
});

describe("assignDraftAction — reassignment", () => {
  it("requires confirmation when the current assignee has meaningful work (first_opened_at set)", async () => {
    const service = makeService({
      firstOpenedAt: "2026-01-01T00:00:00.000Z",
      currentActive: [{ id: "a-old", reviewer_id: "rev-old", status: "in_progress" }],
    });
    serviceMock.mockReturnValue(service);
    const res = await assignDraftAction({ draftId: "d1", reviewerId: "rev-new" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.data?.requiresConfirmation).toBe(true);
      expect(res.data?.warning).toMatch(/already contains work/i);
    }
    // Must not have touched the DB at all before confirmation.
    expect(service._inserts).toHaveLength(0);
  });

  it("proceeds once confirmed: marks the old assignment 'reassigned', inserts the new one", async () => {
    const service = makeService({
      firstOpenedAt: "2026-01-01T00:00:00.000Z",
      currentActive: [{ id: "a-old", reviewer_id: "rev-old", status: "in_progress" }],
    });
    serviceMock.mockReturnValue(service);
    const res = await assignDraftAction({ draftId: "d1", reviewerId: "rev-new", confirmed: true });
    expect(res.ok).toBe(true);
    expect(service._updates.some((u) => u.matchId === "a-old" && (u.patch as any).status === "reassigned")).toBe(
      true
    );
    expect(service._inserts).toHaveLength(1);
  });

  it("does NOT require confirmation when the current assignee never opened it (no meaningful work yet)", async () => {
    const service = makeService({
      firstOpenedAt: null,
      currentActive: [{ id: "a-old", reviewer_id: "rev-old", status: "assigned" }],
    });
    serviceMock.mockReturnValue(service);
    const res = await assignDraftAction({ draftId: "d1", reviewerId: "rev-new" });
    expect(res.ok).toBe(true);
  });
});

describe("assignDraftAction — permissions", () => {
  it("a non-admin cannot assign", async () => {
    sessionMock.mockResolvedValue({
      userId: "r1",
      email: "r@x.org",
      profile: { user_id: "r1", display_name: "R", role: "reviewer", can_publish: false, active: true },
    });
    const res = await assignDraftAction({ draftId: "d1", reviewerId: "rev-1" });
    expect(res.ok).toBe(false);
  });
});
