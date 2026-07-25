import { describe, it, expect, vi, beforeEach } from "vitest";

// Regression test for a real bug: getAssignedDrafts() (the reviewer's
// personal "Your reviews" queue) queried draft_assignments with no filter,
// relying entirely on RLS. RLS's da_select_own_or_admin policy deliberately
// lets an admin read EVERY assignment row (so the admin dashboard can see
// everything) — which meant an admin's own personal dashboard was showing
// every reviewer's assignments, not just their own.

const getUser = vi.fn();
const eqSpy = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  getServerSupabase: () => ({
    auth: { getUser: () => getUser() },
    from: (table: string) => ({
      select: () => ({
        eq: (...args: unknown[]) => {
          if (table === "draft_assignments") eqSpy(...args);
          return Promise.resolve({ data: [] });
        },
      }),
    }),
  }),
}));

beforeEach(() => {
  getUser.mockReset();
  eqSpy.mockReset();
});

describe("getAssignedDrafts — a personal queue, not an admin-wide one", () => {
  it("filters draft_assignments to the CALLER's own reviewer_id, not just RLS", async () => {
    const { getAssignedDrafts } = await import("@/lib/reviewer/data");
    getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    await getAssignedDrafts();
    expect(eqSpy).toHaveBeenCalledWith("reviewer_id", "admin-1");
  });

  it("returns nothing when there is no signed-in user, before ever querying assignments", async () => {
    const { getAssignedDrafts } = await import("@/lib/reviewer/data");
    getUser.mockResolvedValue({ data: { user: null } });
    const rows = await getAssignedDrafts();
    expect(rows).toEqual([]);
    expect(eqSpy).not.toHaveBeenCalled();
  });
});
