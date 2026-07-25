// Server-side data-access for the reviewer portal. Reviewer-facing reads use
// the RLS-scoped server client (so a reviewer physically cannot load a draft
// they aren't assigned to — the database enforces it). Admin reads use the
// service-role client behind an admin check. Never called from the browser.

import { getServerSupabase } from "../supabaseServer";
import { getServiceSupabase } from "../supabaseAdmin";
import { requiredSectionsComplete, unresolvedFlagCount, type FlagResolutionStatus } from "./publishGate";
import { deriveDashboardStatus, type DashboardStatus, type DraftReviewStatus } from "./dashboardStatus";
import { normalizeSentencedText } from "../geneResearch/types";
import type { GenePageDraft } from "../geneResearch/types";

export type FlagResolutionRow = {
  flag_index: number;
  original_flag_text: string;
  status: FlagResolutionStatus;
  reviewer_note: string | null;
  section_affected: string | null;
};

export type DashboardRow = {
  draftId: string;
  geneSlug: string;
  geneSymbol: string;
  status: DashboardStatus;
  flagCount: number;
  unresolvedFlags: number;
  updatedAt: string | null;
  assignmentStatus: "assigned" | "in_progress" | "completed";
  assignedReviewerName?: string;
};

/** Drafts assigned to the current reviewer (RLS-scoped) + their flag progress. */
export async function getAssignedDrafts(): Promise<DashboardRow[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];

  const { data: assignments } = await supabase
    .from("draft_assignments")
    .select("draft_id, status, assigned_at");
  if (!assignments?.length) return [];

  const rows: DashboardRow[] = [];
  for (const a of assignments) {
    const { data: draft } = await supabase
      .from("gene_page_drafts")
      .select("id, gene_slug, gene_symbol, review_flags, generated_at, reviewed_at, review_status")
      .eq("id", a.draft_id)
      .maybeSingle();
    if (!draft) continue;

    const flagCount = Array.isArray(draft.review_flags) ? draft.review_flags.length : 0;
    const { data: resolutions } = await supabase
      .from("review_flag_resolutions")
      .select("flag_index, status")
      .eq("draft_id", a.draft_id);
    const unresolved = unresolvedFlagCount(
      flagCount,
      (resolutions ?? []).map((r) => ({ flagIndex: r.flag_index, status: r.status as FlagResolutionStatus }))
    );

    const { data: published } = await supabase
      .from("gene_page_versions")
      .select("id")
      .eq("gene_slug", draft.gene_slug)
      .eq("status", "published")
      .limit(1);
    const hasPublished = Boolean(published?.length);

    rows.push({
      draftId: draft.id,
      geneSlug: draft.gene_slug,
      geneSymbol: draft.gene_symbol,
      flagCount,
      unresolvedFlags: unresolved,
      updatedAt: draft.reviewed_at ?? draft.generated_at ?? null,
      assignmentStatus: a.status,
      status: deriveDashboardStatus({
        hasAssignment: true,
        reviewStatus: (draft.review_status ?? "unreviewed") as DraftReviewStatus,
        hasPublishedVersion: hasPublished,
        hasBlockingTicket: false, // wired once the ticket system exists
        hasEdits: Boolean(draft.reviewed_at),
      }),
    });
  }
  return rows;
}

export type DraftForReview = {
  draftId: string;
  geneSlug: string;
  geneSymbol: string;
  content: GenePageDraft;
  reviewFlags: string[];
  resolutions: FlagResolutionRow[];
  sectionsComplete: boolean;
  unresolvedFlags: number;
  reviewStatus: DraftReviewStatus;
  changesRequestedNote: string | null;
};

/** Full draft + resolutions for the review page (RLS-scoped: only if assigned). */
export async function getDraftForReview(draftId: string): Promise<DraftForReview | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data: draft } = await supabase
    .from("gene_page_drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return null; // RLS: not assigned → no row

  const { data: resolutions } = await supabase
    .from("review_flag_resolutions")
    .select("flag_index, original_flag_text, status, reviewer_note, section_affected")
    .eq("draft_id", draftId)
    .order("flag_index");

  const content = draftRowToContent(draft);
  const reviewFlags = Array.isArray(draft.review_flags) ? (draft.review_flags as string[]) : [];
  const resRows = (resolutions ?? []) as FlagResolutionRow[];

  return {
    draftId: draft.id,
    geneSlug: draft.gene_slug,
    geneSymbol: draft.gene_symbol,
    content,
    reviewFlags,
    resolutions: resRows,
    sectionsComplete: requiredSectionsComplete(content),
    unresolvedFlags: unresolvedFlagCount(
      reviewFlags.length,
      resRows.map((r) => ({ flagIndex: r.flag_index, status: r.status }))
    ),
    reviewStatus: (draft.review_status ?? "unreviewed") as DraftReviewStatus,
    changesRequestedNote: draft.changes_requested_note ?? null,
  };
}

/** Reconstruct a GenePageDraft from a gene_page_drafts row. Every narrative
 *  field is run through normalizeSentencedText() so a row generated before
 *  sentence-level citations existed (old { text, sourceIds } shape) still
 *  loads safely — as a single "sentence" spanning its original text — rather
 *  than crashing the review workspace. */
export function draftRowToContent(d: Record<string, any>): GenePageDraft {
  return {
    gene: d.gene_symbol,
    summaryCard: normalizeSentencedText(d.summary_card),
    whatThisGeneMeans: normalizeSentencedText(d.what_this_gene_means),
    howItMayAffectVision: normalizeSentencedText(d.how_it_may_affect_vision),
    whatIsKnown: normalizeSentencedText(d.what_is_known),
    whatIsUncertain: normalizeSentencedText(d.what_is_uncertain),
    whatYouCanDoNext: normalizeSentencedText(d.what_you_can_do_next),
    questionsForClinician: d.questions_for_clinician ?? [],
    forFamilyAndCaregivers: normalizeSentencedText(d.for_family_and_caregivers),
    treatmentAndResearch: normalizeSentencedText(d.treatment_and_research),
    clinicalTrialSummary: normalizeSentencedText(d.clinical_trial_summary),
    researchCards: d.research_cards ?? [],
    sources: d.sources ?? [],
    reviewFlags: d.review_flags ?? [],
    reviewStatus: "unreviewed",
    generatedAt: d.generated_at ?? new Date().toISOString(),
  };
}

// ---- Admin reads (service-role, behind an admin check by the caller) -------

export async function getAdminOverview() {
  const service = getServiceSupabase();
  if (!service) return { drafts: [], reviewers: [], assignments: [] };
  const [{ data: drafts }, { data: reviewers }, { data: assignments }] = await Promise.all([
    service.from("gene_page_drafts").select("id, gene_slug, gene_symbol, review_status, generated_at"),
    service.from("reviewer_profiles").select("user_id, display_name, role, can_publish, active"),
    service.from("draft_assignments").select("id, draft_id, reviewer_id, status, assigned_at"),
  ]);
  return { drafts: drafts ?? [], reviewers: reviewers ?? [], assignments: assignments ?? [] };
}
