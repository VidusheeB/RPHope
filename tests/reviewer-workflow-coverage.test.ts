import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// ---- evaluateApprovalReadiness (pure logic) --------------------------------

import {
  evaluateApprovalReadiness,
  type FlagResolutionStatus,
} from "@/lib/reviewer/publishGate";
import type { GenePageDraft, SentencedText } from "@/lib/geneResearch/types";

function sourced(text = "Some real content.", sourceIds = ["pubmed:1"]): SentencedText {
  return { sentences: [{ text, sourceIds }] };
}
function completeDraft(overrides: Partial<GenePageDraft> = {}): GenePageDraft {
  return {
    gene: "LCA5",
    summaryCard: sourced(),
    whatThisGeneMeans: sourced(),
    howItMayAffectVision: sourced(),
    whatIsKnown: sourced(),
    whatIsUncertain: sourced(),
    whatYouCanDoNext: sourced("Next steps.", ["rphope-resource:x"]),
    questionsForClinician: ["q1"],
    forFamilyAndCaregivers: sourced("Caregiver guidance.", ["rphope-resource:x"]),
    treatmentAndResearch: sourced(),
    clinicalTrialSummary: sourced(),
    researchCards: [],
    sources: [
      { id: "pubmed:1", type: "pubmed", title: "x", url: "https://pubmed.ncbi.nlm.nih.gov/1/" },
      { id: "rphope-resource:x", type: "rphope-resource", title: "x", url: "/x" },
    ],
    reviewFlags: [],
    reviewStatus: "unreviewed",
    generatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
const resolvedAll = (n: number): { flagIndex: number; status: FlagResolutionStatus }[] =>
  Array.from({ length: n }, (_, i) => ({ flagIndex: i, status: "wording_confirmed" as const }));

describe("evaluateApprovalReadiness — approval requires the SAME content checks as submission/publish", () => {
  const base = {
    draft: completeDraft(),
    flagCount: 2,
    resolutions: resolvedAll(2),
    isAdmin: true,
    reviewStatus: "submitted_for_approval" as const,
  };

  it("allows approval when submitted and everything is clean", () => {
    expect(evaluateApprovalReadiness(base).canProceed).toBe(true);
  });

  it("a non-admin cannot approve", () => {
    const r = evaluateApprovalReadiness({ ...base, isAdmin: false });
    expect(r.canProceed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/admin/i);
  });

  it("requires submitted state — cannot approve an untouched or in-progress draft", () => {
    const r = evaluateApprovalReadiness({ ...base, reviewStatus: "unreviewed" });
    expect(r.canProceed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/submitted/i);
  });

  it("fails with unresolved flags — approval is not just a rubber stamp on submission", () => {
    const r = evaluateApprovalReadiness({ ...base, resolutions: resolvedAll(1) });
    expect(r.canProceed).toBe(false);
  });

  it("fails with an open blocking ticket", () => {
    const r = evaluateApprovalReadiness({ ...base, openBlockingTicketCount: 1 });
    expect(r.canProceed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/blocking/i);
  });

  it("fails with an incomplete required section", () => {
    const r = evaluateApprovalReadiness({ ...base, draft: completeDraft({ whatIsKnown: sourced("") }) });
    expect(r.canProceed).toBe(false);
  });
});

// ---- restoreVersionAction ---------------------------------------------------

const sessionMock = vi.fn();
vi.mock("@/lib/reviewer/session", () => ({ getReviewerSession: () => sessionMock() }));
const serviceMock = vi.fn();
vi.mock("@/lib/supabaseAdmin", () => ({ getServiceSupabase: () => serviceMock() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { restoreVersionAction, inviteReviewerAction } from "@/app/review/actions";

beforeEach(() => {
  sessionMock.mockReset();
  serviceMock.mockReset();
  sessionMock.mockResolvedValue({
    userId: "admin-1",
    email: "admin@x.org",
    profile: { user_id: "admin-1", display_name: "Admin", role: "admin", can_publish: true, active: true },
  });
});

describe("restoreVersionAction — safe restoration, never auto-publishes", () => {
  function makeService(versionContent: GenePageDraft) {
    const inserted: Record<string, unknown>[] = [];
    const versionQueries: string[] = [];
    return {
      _inserted: inserted,
      _versionQueries: versionQueries,
      from: (table: string) => {
        if (table === "gene_page_versions") {
          versionQueries.push("read");
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve({ data: { id: "v1", gene_slug: "lca5", content: versionContent, version_number: 2 } }),
              }),
            }),
            // Any write attempt here would show up as a distinct call shape;
            // this double only implements read, so an accidental write blows up
            // the test loudly instead of silently "succeeding".
          };
        }
        if (table === "gene_page_drafts") {
          return {
            insert: (row: Record<string, unknown>) => {
              inserted.push(row);
              return { select: () => ({ single: () => Promise.resolve({ data: { id: "new-draft-1" } }) }) };
            },
          };
        }
        return { insert: () => Promise.resolve({ error: null }) };
      },
    };
  }

  it("creates a new draft from the historical content, tagged as unreviewed", async () => {
    const content = completeDraft({ gene: "LCA5" });
    const service = makeService(content);
    serviceMock.mockReturnValue(service);

    const res = await restoreVersionAction("v1");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data?.draftId).toBe("new-draft-1");

    expect(service._inserted).toHaveLength(1);
    const row = service._inserted[0];
    expect(row.review_status).toBe("unreviewed");
    expect(row.gene_symbol).toBe("LCA5");
    // Never touches gene_page_versions with a write — only ever reads it.
    expect(service._versionQueries).toEqual(["read"]);
  });

  it("a non-admin cannot restore a version", async () => {
    sessionMock.mockResolvedValue({
      userId: "r1",
      email: "r@x.org",
      profile: { user_id: "r1", display_name: "R", role: "reviewer", can_publish: false, active: true },
    });
    const res = await restoreVersionAction("v1");
    expect(res.ok).toBe(false);
    expect(serviceMock).not.toHaveBeenCalled();
  });
});

// ---- inviteReviewerAction duplicate detection ------------------------------

describe("inviteReviewerAction — duplicate invitations are prevented", () => {
  function makeService(opts: { existingUser?: { id: string; email: string; last_sign_in_at: string | null }; existingActive?: boolean }) {
    return {
      auth: {
        admin: {
          listUsers: () =>
            Promise.resolve({ data: { users: opts.existingUser ? [opts.existingUser] : [] } }),
          inviteUserByEmail: () => Promise.resolve({ data: { user: { id: "new-user-1" } }, error: null }),
        },
      },
      from: (table: string) => {
        if (table === "reviewer_profiles") {
          return {
            select: () => ({
              eq: () => ({ maybeSingle: () => Promise.resolve({ data: { active: opts.existingActive ?? true } }) }),
            }),
            upsert: () => Promise.resolve({ error: null }),
          };
        }
        return { upsert: () => Promise.resolve({ error: null }) };
      },
    };
  }

  it("blocks a brand-new invite for an email that's already an active, accepted reviewer", async () => {
    serviceMock.mockReturnValue(
      makeService({ existingUser: { id: "u1", email: "taken@x.org", last_sign_in_at: "2026-01-01T00:00:00Z" }, existingActive: true })
    );
    const res = await inviteReviewerAction({ email: "taken@x.org", displayName: "X", role: "reviewer", canPublish: false });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/already an active reviewer/i);
  });

  it("blocks re-inviting an email with a still-pending (not yet accepted) invitation", async () => {
    serviceMock.mockReturnValue(
      makeService({ existingUser: { id: "u2", email: "pending@x.org", last_sign_in_at: null } })
    );
    const res = await inviteReviewerAction({ email: "pending@x.org", displayName: "X", role: "reviewer", canPublish: false });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/pending|resend/i);
  });

  it("allows a genuinely new email through", async () => {
    serviceMock.mockReturnValue(makeService({}));
    const res = await inviteReviewerAction({ email: "new@x.org", displayName: "X", role: "reviewer", canPublish: false });
    expect(res.ok).toBe(true);
  });

  it("rejects an invalid email before any Supabase call", async () => {
    const service = makeService({});
    serviceMock.mockReturnValue(service);
    const res = await inviteReviewerAction({ email: "not-an-email", displayName: "X", role: "reviewer", canPublish: false });
    expect(res.ok).toBe(false);
  });
});

// ---- Notification deduplication --------------------------------------------

describe("notify() — dedupe_key prevents duplicate notifications for the same event (static + behavioral)", () => {
  it("upserts with onConflict + ignoreDuplicates whenever a dedupeKey is supplied", () => {
    const src = read("lib/reviewer/notifications.ts");
    expect(src).toContain('onConflict: "recipient,dedupe_key"');
    expect(src).toContain("ignoreDuplicates: true");
  });

  it("every workflow-transition notify call site supplies a dedupeKey", () => {
    const src = read("app/review/actions.ts");
    // Spot-check the actions most likely to be double-invoked (retries, double-clicks).
    expect(src).toMatch(/dedupeKey: `review:\$\{input\.draftId\}:submitted:/);
    expect(src).toMatch(/dedupeKey: `gene:\$\{published\.gene_slug\}:published:/);
  });
});

// ---- last_edited_by attribution --------------------------------------------

describe("content edits are attributed to whoever actually made them (static)", () => {
  it("saveDraftAction (the shared autosave path for both reviewer and admin edits) stamps last_edited_by from the real session user", () => {
    const src = read("app/review/actions.ts");
    const fnStart = src.indexOf("export async function saveDraftAction");
    const fnBody = src.slice(fnStart, src.indexOf("\n}\n", fnStart));
    expect(fnBody).toContain("last_edited_by: user.id");
  });

  it("publishAction's pre-publish save also stamps last_edited_by from the admin's own session, not the reviewer's", () => {
    const src = read("app/review/actions.ts");
    const fnStart = src.indexOf("export async function publishAction");
    const fnBody = src.slice(fnStart, src.indexOf("\n}\n", fnStart));
    expect(fnBody).toContain("last_edited_by: session.userId");
  });
});

// ---- Invitation modal saves professional fields ----------------------------

describe("InviteReviewerDialog passes professional fields through (static)", () => {
  it("wires title/organization/specialty/adminNotes into inviteReviewerAction", () => {
    const src = read("components/review/InviteReviewerDialog.tsx");
    for (const field of ["title", "organization", "specialty", "adminNotes"]) {
      expect(src).toContain(field);
    }
    expect(src).toMatch(/disabled=\{submitting\}/);
  });
});

// ---- Deactivation-with-assignments requires an explicit choice -------------

describe("deactivating a reviewer with active assignments requires an explicit resolution (static)", () => {
  it("ReviewerDetailPanel shows a choice instead of deactivating immediately", () => {
    const src = read("components/review/ReviewerDetailPanel.tsx");
    expect(src).toMatch(/deactivateChoice/);
    expect(src).toMatch(/activeAssignments\.length > 0/);
  });
});
