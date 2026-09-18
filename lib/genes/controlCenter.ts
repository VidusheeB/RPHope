// The Genes control center's read model.
//
// Joins two things that were previously separate: the CATALOG (every gene RP
// Hope intends to cover, lib/geneGrid) and the DRAFT PIPELINE (rows that
// actually exist in gene_page_drafts). The old admin queue could only show
// genes that already had a draft, so "38 genes still need generating" was
// invisible — it's the difference between a review queue and an operations
// console.
//
// Service-role; callers must have proven `genes.review.all` first.

import { getAdminDraftQueue, type AdminDraftRow } from "@/lib/reviewer/data";
import { getGeneGenerationState, type GenerationStatus } from "@/lib/genes/generationQueue";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

/** The operational buckets the Genes page tabs map onto. One gene sits in
 *  exactly one bucket, so the tab counts always sum to the catalog. */
export type GeneBucket =
  | "needs_generation"
  | "failed"
  | "unassigned"
  | "in_review"
  | "awaiting_publication"
  | "published";

export type GeneControlRow = {
  geneSlug: string;
  geneSymbol: string;
  bucket: GeneBucket;
  /** Latest generation job state, when there is one. */
  generationStatus: GenerationStatus | null;
  generationError: string | null;
  /** May this gene be included in a generation run right now? */
  eligible: boolean;
  draftId: string | null;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  updatedAt: string | null;
  unresolvedFlags: number;
  hasPublishedVersion: boolean;
};

/** Exported for unit testing — the bucket rules are the thing most likely
 *  to drift as states are added, and they're pure. */
export function bucketFor(
  hasDraft: boolean,
  generationStatus: GenerationStatus | null,
  draft: AdminDraftRow | undefined
): GeneBucket {
  if (!hasDraft || !draft) {
    // A failed job is its own bucket so it surfaces for retry instead of
    // blending back in with genes nobody has tried yet.
    if (generationStatus === "failed") return "failed";
    return "needs_generation";
  }
  if (draft.publicationState === "published") return "published";
  // The reviewer's "Approve Review" puts a draft in submitted_for_approval;
  // an admin's separate approval step moves it to approved. Both mean the
  // same thing operationally — a human is done with it and it is waiting on
  // an administrator — so they share one queue.
  if (draft.reviewState === "submitted" || draft.reviewState === "approved") {
    return "awaiting_publication";
  }
  if (draft.reviewState === "unassigned") return "unassigned";
  return "in_review";
}

export async function getGeneControlRows(): Promise<GeneControlRow[]> {
  const [generation, drafts] = await Promise.all([getGeneGenerationState(), getAdminDraftQueue()]);
  const draftBySlug = new Map(drafts.map((d) => [d.geneSlug, d]));

  return generation.map((g) => {
    const draft = draftBySlug.get(g.geneSlug);
    const generationStatus = g.latestJob?.status ?? null;
    return {
      geneSlug: g.geneSlug,
      geneSymbol: g.geneSymbol,
      bucket: bucketFor(g.hasDraft, generationStatus, draft),
      generationStatus,
      generationError: g.latestJob?.error ?? null,
      eligible: g.eligible,
      draftId: draft?.draftId ?? null,
      assignedReviewerId: draft?.assignedReviewerId ?? null,
      assignedReviewerName: draft?.assignedReviewerName ?? null,
      updatedAt: draft?.updatedAt ?? g.latestJob?.finishedAt ?? null,
      unresolvedFlags: draft?.unresolvedFlags ?? 0,
      hasPublishedVersion: draft?.hasPublishedVersion ?? false,
    };
  });
}

export type BucketCounts = Record<GeneBucket, number> & { all: number };

export function countBuckets(rows: GeneControlRow[]): BucketCounts {
  const counts: BucketCounts = {
    all: rows.length,
    needs_generation: 0,
    failed: 0,
    unassigned: 0,
    in_review: 0,
    awaiting_publication: 0,
    published: 0,
  };
  for (const r of rows) counts[r.bucket] += 1;
  return counts;
}

export type AssignableReviewer = {
  userId: string;
  displayName: string;
  /** How many drafts they currently hold — enough for an admin to make an
   *  informed choice, deliberately not a workload-optimisation system. */
  activeGenes: number;
};

/** Active reviewers who can take an assignment, with their current load.
 *  Inactive accounts are excluded: assigning work to someone who cannot log
 *  in would silently stall that gene. */
export async function getAssignableReviewers(): Promise<AssignableReviewer[]> {
  const service = getServiceSupabase();
  if (!service) return [];

  const [{ data: profiles }, { data: assignments }] = await Promise.all([
    service
      .from("reviewer_profiles")
      .select("user_id, display_name, role, active")
      .eq("active", true),
    service.from("draft_assignments").select("reviewer_id, status"),
  ]);

  const load = new Map<string, number>();
  for (const a of assignments ?? []) {
    if (a.status === "completed" || a.status === "reassigned") continue;
    load.set(a.reviewer_id, (load.get(a.reviewer_id) ?? 0) + 1);
  }

  return (profiles ?? [])
    .map((p) => ({
      userId: p.user_id,
      displayName: p.display_name,
      activeGenes: load.get(p.user_id) ?? 0,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
