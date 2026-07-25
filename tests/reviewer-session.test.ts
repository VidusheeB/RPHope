import { describe, it, expect, vi, beforeEach } from "vitest";

// A separate file from reviewer-permissions.test.ts on purpose: vi.mock()
// calls are hoisted to file scope regardless of which describe/it block
// they're written in, so a file that also mocks "@/lib/reviewer/session"
// (to test code that DEPENDS on it) can't also unit-test session.ts's real
// implementation — the two mocks would collide.

const getUser = vi.fn();
const profileMaybeSingle = vi.fn();

vi.mock("@/lib/supabaseServer", () => ({
  getServerSupabase: () => ({
    auth: { getUser: () => getUser() },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => profileMaybeSingle() }) }),
    }),
  }),
}));

beforeEach(() => {
  getUser.mockReset();
  profileMaybeSingle.mockReset();
});

describe("getReviewerSession — inactive/missing profile is treated as signed out", () => {
  it("returns null when there is no authenticated user", async () => {
    const { getReviewerSession } = await import("@/lib/reviewer/session");
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getReviewerSession()).toBeNull();
  });

  it("returns null when reviewer_profiles.active is false, even with a valid auth session", async () => {
    const { getReviewerSession } = await import("@/lib/reviewer/session");
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@x.org" } } });
    profileMaybeSingle.mockResolvedValue({
      data: { user_id: "u1", display_name: "A", role: "reviewer", can_publish: false, active: false },
    });
    expect(await getReviewerSession()).toBeNull();
  });

  it("returns null when the reviewer has no profile row at all", async () => {
    const { getReviewerSession } = await import("@/lib/reviewer/session");
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@x.org" } } });
    profileMaybeSingle.mockResolvedValue({ data: null });
    expect(await getReviewerSession()).toBeNull();
  });

  it("returns a session for an active profile", async () => {
    const { getReviewerSession } = await import("@/lib/reviewer/session");
    getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@x.org" } } });
    profileMaybeSingle.mockResolvedValue({
      data: { user_id: "u1", display_name: "A", role: "reviewer", can_publish: false, active: true },
    });
    const session = await getReviewerSession();
    expect(session?.userId).toBe("u1");
  });
});
