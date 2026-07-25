import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { GenePageDraft, SentencedText } from "@/lib/geneResearch/types";

// ---- Mock the session, service client, and next/cache -----------------------
const revalidateSpy = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (p: string) => revalidateSpy(p) }));

const sessionMock = vi.fn();
vi.mock("@/lib/reviewer/session", () => ({ getReviewerSession: () => sessionMock() }));

const serviceMock = vi.fn();
vi.mock("@/lib/supabaseAdmin", () => ({ getServiceSupabase: () => serviceMock() }));

import { publishAction } from "@/app/review/actions";

function sourced(text = "Real content.", sourceIds = ["pubmed:1"]): SentencedText {
  return { sentences: [{ text, sourceIds }] };
}
function completeDraft(): GenePageDraft {
  return {
    gene: "LCA5",
    summaryCard: sourced(),
    whatThisGeneMeans: sourced(),
    howItMayAffectVision: sourced(),
    whatIsKnown: sourced(),
    whatIsUncertain: sourced(),
    whatYouCanDoNext: sourced("Next.", ["rphope-resource:x"]),
    questionsForClinician: ["q1"],
    forFamilyAndCaregivers: sourced("Care.", ["rphope-resource:x"]),
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
  };
}

// Minimal chainable Supabase-like service double. Publishing is admin-only
// now, so the mocked draft row carries review_status: 'submitted_for_approval'
// (the normal, non-override path) and the session is an admin.
function makeService(opts: {
  rpc: { data: unknown; error: unknown };
  saveError?: unknown;
  reviewStatus?: string;
}) {
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    let isUpdate = false;
    Object.assign(b, {
      select: () => b,
      update: () => {
        isUpdate = true;
        return b;
      },
      eq: () => b,
      order: () => b,
      limit: () => b,
      maybeSingle: () => {
        if (table === "gene_page_drafts")
          return Promise.resolve({
            data: {
              id: "d1",
              gene_slug: "lca5",
              review_flags: [],
              review_status: opts.reviewStatus ?? "submitted_for_approval",
            },
          });
        if (table === "draft_assignments") return Promise.resolve({ data: { id: "a1", status: "assigned" } });
        return Promise.resolve({ data: null });
      },
      then: (resolve: (v: unknown) => unknown) => {
        if (table === "review_flag_resolutions") return resolve({ data: [] });
        if (table === "gene_page_drafts" && isUpdate) return resolve({ error: opts.saveError ?? null });
        return resolve({ data: null });
      },
    });
    return b;
  };
  return {
    from: (t: string) => builder(t),
    rpc: () => ({ single: () => Promise.resolve(opts.rpc) }),
  };
}

beforeEach(() => {
  revalidateSpy.mockReset();
  sessionMock.mockReset();
  serviceMock.mockReset();
  // publishAction is admin-only — see reviewer-security.test.ts for the
  // "a reviewer can never publish" coverage.
  sessionMock.mockResolvedValue({
    userId: "u1",
    email: "a@x.org",
    profile: { user_id: "u1", display_name: "A", role: "admin", can_publish: true, active: true },
  });
});

describe("publishAction — atomic publish via RPC", () => {
  it("on RPC success: returns the new version id + slug AND revalidates AFTER commit", async () => {
    serviceMock.mockReturnValue(
      makeService({ rpc: { data: { version_id: "v-new", gene_slug: "lca5" }, error: null } })
    );
    const res = await publishAction({ draftId: "d1", content: completeDraft(), confirmationChecked: true });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data?.versionId).toBe("v-new");
      expect(res.data?.publishedUrl).toBe("/genetic-insights/lca5");
    }
    expect(revalidateSpy).toHaveBeenCalledWith("/genetic-insights/lca5");
  });

  it("on RPC failure: returns an error and does NOT revalidate (nothing went live)", async () => {
    serviceMock.mockReturnValue(
      makeService({ rpc: { data: null, error: { message: "deadlock" } } })
    );
    const res = await publishAction({ draftId: "d1", content: completeDraft(), confirmationChecked: true });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/deadlock/);
    expect(revalidateSpy).not.toHaveBeenCalled();
  });

  it("blocks (no RPC call) when the publish gate is not satisfied", async () => {
    const rpc = { single: vi.fn() };
    serviceMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "d1", gene_slug: "lca5", review_flags: [], review_status: "submitted_for_approval" },
                }),
            }),
            order: () => ({
              limit: () => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: { id: "d1", gene_slug: "lca5", review_flags: [], review_status: "submitted_for_approval" },
                  }),
              }),
            }),
            maybeSingle: () =>
              Promise.resolve({
                data: { id: "d1", gene_slug: "lca5", review_flags: [], review_status: "submitted_for_approval" },
              }),
            then: (r: (v: unknown) => unknown) => r({ data: [] }),
          }),
        }),
      }),
      rpc: () => rpc,
    });
    // confirmationChecked false → gate fails before any RPC.
    const res = await publishAction({ draftId: "d1", content: completeDraft(), confirmationChecked: false });
    expect(res.ok).toBe(false);
    expect(rpc.single).not.toHaveBeenCalled();
    expect(revalidateSpy).not.toHaveBeenCalled();
  });

  it("blocks a non-admin before any DB read (reviewers can never publish)", async () => {
    sessionMock.mockResolvedValue({
      userId: "u2",
      email: "r@x.org",
      profile: { user_id: "u2", display_name: "R", role: "reviewer", can_publish: true, active: true },
    });
    const service = vi.fn();
    serviceMock.mockReturnValue(service);
    const res = await publishAction({ draftId: "d1", content: completeDraft(), confirmationChecked: true });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/admin/i);
    expect(serviceMock).not.toHaveBeenCalled();
  });
});

// ---- Static assertions on the transactional RPC + partial unique index ------
describe("atomic publish — SQL guarantees (static)", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/0003_reviewer_portal.sql"),
    "utf8"
  );

  it("defines a single transactional plpgsql RPC for publishing", () => {
    expect(sql).toMatch(/create or replace function public\.publish_gene_version/);
    expect(sql).toMatch(/language plpgsql/);
  });

  it("serializes concurrent publishes per gene with a transaction-scoped advisory lock", () => {
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("gene_publish:");
  });

  it("archives the prior published row and inserts a new published row in the same function", () => {
    expect(sql).toMatch(/update public\.gene_page_versions\s+set status = 'archived'/);
    expect(sql).toMatch(/insert into public\.gene_page_versions/);
  });

  it("is idempotent for a double-submit of the same draft (guard before re-inserting)", () => {
    expect(sql).toMatch(/status = 'published' and source_draft_id = p_draft_id/);
  });

  it("enforces at most one published version per gene via a partial unique index", () => {
    expect(sql).toMatch(/unique index[\s\S]*gene_page_versions \(gene_slug\) where status = 'published'/);
  });

  it("grants EXECUTE on the publish RPC only to service_role (no reviewer path)", () => {
    expect(sql).toMatch(/revoke execute on function public\.publish_gene_version[\s\S]*from public/);
    expect(sql).toMatch(/grant execute on function public\.publish_gene_version[\s\S]*to service_role/);
  });
});

describe("admin access — SQL guarantees for the bug that was fixed (static)", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/migrations/0003_reviewer_portal.sql"),
    "utf8"
  );

  it("gene_page_drafts SELECT policy already allows admins regardless of assignment", () => {
    expect(sql).toMatch(/gpd_select_assigned[\s\S]*auth_is_assigned\(id\) or auth_is_admin\(\)/);
  });

  it("gene_page_drafts UPDATE policy already allows admins regardless of assignment", () => {
    expect(sql).toMatch(/gpd_update_active_assignee[\s\S]*auth_is_active_assignee\(id\) or auth_is_admin\(\)/);
  });
});
