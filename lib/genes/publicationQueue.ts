// The admin publication queue: genes a human has finished reviewing that are
// waiting on an administrator.
//
// Service-role; callers must have proven `genes.review.all` (to see the queue)
// or `genes.publish` (to act on it) first.

import { getServiceSupabase } from "@/lib/supabaseAdmin";
import type { GenePageDraft } from "@/lib/geneResearch/types";

export type AwaitingPublication = {
  draftId: string;
  geneSlug: string;
  geneSymbol: string;
  reviewStatus: string;
  approvedByName: string | null;
  approvedAt: string | null;
  /** True when the exact reviewer-approved snapshot is on file. False for
   *  drafts submitted before 0026 added the column — surfaced in the UI
   *  rather than hidden, because "we can't prove what was approved" is
   *  something an administrator should know BEFORE publishing. */
  hasApprovedSnapshot: boolean;
};

export type PublicationDetail = AwaitingPublication & {
  /** Exactly what will go live. Read from the snapshot when present. */
  content: GenePageDraft | null;
  /** The live draft, for comparison when the two differ. */
  liveContent: GenePageDraft | null;
  currentlyPublishedVersion: number | null;
};

/** Rebuild the camelCase draft shape from the snake_case row. Mirrors
 *  serializeDraft() in app/review/actions.ts, in the other direction. */
function rowToDraft(row: Record<string, unknown>): GenePageDraft {
  return {
    summaryCard: row.summary_card,
    whatThisGeneMeans: row.what_this_gene_means,
    howItMayAffectVision: row.how_it_may_affect_vision,
    whatIsKnown: row.what_is_known,
    whatIsUncertain: row.what_is_uncertain,
    whatYouCanDoNext: row.what_you_can_do_next,
    questionsForClinician: row.questions_for_clinician,
    forFamilyAndCaregivers: row.for_family_and_caregivers,
    treatmentAndResearch: row.treatment_and_research,
    clinicalTrialSummary: row.clinical_trial_summary,
    researchCards: row.research_cards,
    sources: row.sources,
    reviewFlags: row.review_flags,
  } as unknown as GenePageDraft;
}

/** Everything waiting on an administrator, newest approval first. */
export async function getAwaitingPublication(): Promise<AwaitingPublication[]> {
  const service = getServiceSupabase();
  if (!service) return [];

  const { data: drafts } = await service
    .from("gene_page_drafts")
    .select("id, gene_slug, gene_symbol, review_status, submitted_at, submitted_by, submitted_content")
    .in("review_status", ["submitted_for_approval", "approved"])
    .order("submitted_at", { ascending: false });
  if (!drafts?.length) return [];

  const reviewerIds = Array.from(
    new Set(drafts.map((d) => d.submitted_by).filter(Boolean) as string[])
  );
  const { data: profiles } = reviewerIds.length
    ? await service.from("reviewer_profiles").select("user_id, display_name").in("user_id", reviewerIds)
    : { data: [] as { user_id: string; display_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

  return drafts.map((d) => ({
    draftId: d.id,
    geneSlug: d.gene_slug,
    geneSymbol: d.gene_symbol,
    reviewStatus: d.review_status,
    approvedByName: d.submitted_by ? (nameById.get(d.submitted_by) ?? null) : null,
    approvedAt: d.submitted_at,
    hasApprovedSnapshot: d.submitted_content != null,
  }));
}

/** One gene's publication review: the exact approved content, plus the live
 *  draft so a difference can be shown rather than discovered after the fact. */
export async function getPublicationDetail(draftId: string): Promise<PublicationDetail | null> {
  const service = getServiceSupabase();
  if (!service) return null;

  // select("*") rather than an interpolated column list: a template literal
  // defeats supabase-js's select-string type inference, and this is a
  // service-role read of one row where we need most columns anyway.
  const { data } = await service
    .from("gene_page_drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle();
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const draft = {
    id: row.id as string,
    gene_slug: row.gene_slug as string,
    gene_symbol: row.gene_symbol as string,
    review_status: row.review_status as string,
    submitted_at: (row.submitted_at as string | null) ?? null,
    submitted_by: (row.submitted_by as string | null) ?? null,
  };

  let approvedByName: string | null = null;
  if (draft.submitted_by) {
    const { data: p } = await service
      .from("reviewer_profiles")
      .select("display_name")
      .eq("user_id", draft.submitted_by)
      .maybeSingle();
    approvedByName = p?.display_name ?? null;
  }

  const { data: currentVersion } = await service
    .from("gene_page_versions")
    .select("version_number")
    .eq("gene_slug", draft.gene_slug)
    .eq("status", "published")
    .maybeSingle();

  const snapshot = (row.submitted_content as GenePageDraft | null) ?? null;
  const live = rowToDraft(row);

  return {
    draftId: draft.id,
    geneSlug: draft.gene_slug,
    geneSymbol: draft.gene_symbol,
    reviewStatus: draft.review_status,
    approvedByName,
    approvedAt: draft.submitted_at,
    hasApprovedSnapshot: snapshot != null,
    // What will actually go live.
    content: snapshot ?? live,
    liveContent: live,
    currentlyPublishedVersion: currentVersion?.version_number ?? null,
  };
}
