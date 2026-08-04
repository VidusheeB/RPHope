// Server-side data-access for the reviewer portal. Reviewer-facing reads use
// the RLS-scoped server client (so a reviewer physically cannot load a draft
// they aren't assigned to — the database enforces it). Admin reads use the
// service-role client behind an admin check. Never called from the browser.

import { getServerSupabase } from "../supabaseServer";
import { getServiceSupabase } from "../supabaseAdmin";
import { requiredSectionsComplete, unresolvedFlagCount, type FlagResolutionStatus } from "./publishGate";
import {
  deriveReviewState,
  derivePublicationState,
  type ReviewState,
  type PublicationState,
  type DraftReviewStatus,
} from "./dashboardStatus";
import { normalizeSentencedText, NARRATIVE_SECTION_KEYS } from "../geneResearch/types";
import type { GenePageDraft } from "../geneResearch/types";
import { verificationProgress, type SentenceReviewRow } from "./sentenceVerification";
import { countBlockingOpenTickets, countOpenTickets, type TicketSeverity, type TicketStatus, type TicketType } from "./tickets";

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
  reviewState: ReviewState;
  publicationState: PublicationState;
  flagCount: number;
  unresolvedFlags: number;
  updatedAt: string | null;
  assignedAt: string | null;
  assignmentStatus: "assigned" | "in_progress" | "completed" | "reassigned";
  assignedReviewerName?: string;
  openTicketCount: number;
  blockingTicketCount: number;
  hasPublishedVersion: boolean;
  sentencesVerified: number;
  sentencesTotal: number;
};

/** Drafts assigned to the current reviewer + their flag progress. This is a
 *  PERSONAL work queue, so it explicitly filters to reviewer_id = the
 *  caller's own user id — it must NOT rely on RLS alone here, because the
 *  draft_assignments SELECT policy deliberately lets admins read every
 *  assignment row (so the admin dashboard can see everything), which would
 *  otherwise leak every reviewer's assignments into an admin's own "Your
 *  reviews" page. */
export async function getAssignedDrafts(): Promise<DashboardRow[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: assignments } = await supabase
    .from("draft_assignments")
    .select("draft_id, status, assigned_at")
    .eq("reviewer_id", user.id);
  if (!assignments?.length) return [];

  const rows: DashboardRow[] = [];
  for (const a of assignments) {
    const { data: draft } = await supabase
      .from("gene_page_drafts")
      .select("*")
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

    const { data: versions } = await supabase
      .from("gene_page_versions")
      .select("status")
      .eq("gene_slug", draft.gene_slug);
    const hasPublished = (versions ?? []).some((v) => v.status === "published");
    const wasEverPublished = (versions ?? []).length > 0;

    const { data: tickets } = await supabase
      .from("review_tickets")
      .select("status, blocking")
      .eq("draft_id", a.draft_id);
    const ticketRows = (tickets ?? []) as { status: TicketStatus; blocking: boolean }[];
    const blockingTicketCount = countBlockingOpenTickets(ticketRows);

    const { data: sentenceReviews } = await supabase
      .from("draft_sentence_reviews")
      .select("section_key, sentence_index, status")
      .eq("draft_id", a.draft_id);
    const reviewedByKey = new Map((sentenceReviews ?? []).map((r) => [`${r.section_key}:${r.sentence_index}`, r.status]));
    const content = draftRowToContent(draft);
    const sentenceStates = NARRATIVE_SECTION_KEYS.flatMap((key) => {
      const { sentences } = normalizeSentencedText(content[key]);
      return sentences.map((s, i) => ({
        sourceIds: s.sourceIds,
        status: reviewedByKey.get(`${String(key)}:${i}`) ?? "unreviewed",
      }));
    });
    const progress = verificationProgress(sentenceStates);

    rows.push({
      draftId: draft.id,
      geneSlug: draft.gene_slug,
      geneSymbol: draft.gene_symbol,
      flagCount,
      unresolvedFlags: unresolved,
      updatedAt: draft.last_activity_at ?? draft.generated_at ?? null,
      assignedAt: a.assigned_at ?? null,
      assignmentStatus: a.status,
      openTicketCount: countOpenTickets(ticketRows),
      blockingTicketCount,
      hasPublishedVersion: hasPublished,
      sentencesVerified: progress.verified,
      sentencesTotal: progress.total,
      reviewState: deriveReviewState({
        hasAssignment: true,
        reviewStatus: (draft.review_status ?? "unreviewed") as DraftReviewStatus,
        hasEdits: Boolean(draft.first_opened_at),
      }),
      publicationState: derivePublicationState({ hasPublishedVersion: hasPublished, wasEverPublished }),
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
  openBlockingTicketCount: number;
  openTicketCount: number;
};

/** Full draft + resolutions for the review page (RLS-scoped: only if assigned).
 *
 *  Also records first_opened_at exactly once — but ONLY when the CURRENT
 *  USER is the actively assigned reviewer (not an admin previewing someone
 *  else's draft), and only if it isn't already set. This is the "meaningful
 *  first access" the ASSIGNED → IN_PROGRESS transition depends on; it must
 *  never fire for an admin's read, a background fetch, or a page reload
 *  after the first genuine open. */
export async function getDraftForReview(draftId: string): Promise<DraftForReview | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data: draft } = await supabase
    .from("gene_page_drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return null; // RLS: not assigned → no row

  if (!draft.first_opened_at) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: ownAssignment } = await supabase
        .from("draft_assignments")
        .select("id")
        .eq("draft_id", draftId)
        .eq("reviewer_id", user.id)
        .in("status", ["assigned", "in_progress"])
        .maybeSingle();
      if (ownAssignment) {
        const openedAt = new Date().toISOString();
        await supabase
          .from("gene_page_drafts")
          .update({ first_opened_at: openedAt, first_opened_by: user.id, last_activity_at: openedAt })
          .eq("id", draftId);
        draft.first_opened_at = openedAt;
        draft.last_activity_at = openedAt;
        await supabase.from("draft_assignments").update({ status: "in_progress" }).eq("id", ownAssignment.id);
      }
    }
  }

  const { data: resolutions } = await supabase
    .from("review_flag_resolutions")
    .select("flag_index, original_flag_text, status, reviewer_note, section_affected")
    .eq("draft_id", draftId)
    .order("flag_index");

  const content = draftRowToContent(draft);
  const reviewFlags = Array.isArray(draft.review_flags) ? (draft.review_flags as string[]) : [];
  const resRows = (resolutions ?? []) as FlagResolutionRow[];

  const { data: tickets } = await supabase
    .from("review_tickets")
    .select("status, blocking")
    .eq("draft_id", draftId);
  const ticketRows = (tickets ?? []) as { status: TicketStatus; blocking: boolean }[];

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
    openBlockingTicketCount: countBlockingOpenTickets(ticketRows),
    openTicketCount: countOpenTickets(ticketRows),
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

/** All sentence-review rows for a draft (RLS-scoped: only if assigned or
 *  admin). Missing rows just mean "unreviewed, never touched" — the
 *  workspace fills gaps from the draft content itself, this only returns
 *  what's actually been saved. */
export async function getSentenceReviews(draftId: string): Promise<SentenceReviewRow[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("draft_sentence_reviews")
    .select("*")
    .eq("draft_id", draftId);
  return (data ?? []).map((r) => ({
    sectionKey: r.section_key,
    sentenceIndex: r.sentence_index,
    originalText: r.original_text,
    finalText: r.final_text,
    originalSourceIds: r.original_source_ids ?? [],
    finalSourceIds: r.final_source_ids ?? [],
    status: r.status,
    reviewerNote: r.reviewer_note,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at,
  }));
}

export type TicketRow = {
  id: string;
  ticketNumber: number;
  draftId: string;
  sectionKey: string | null;
  type: TicketType;
  subject: string;
  description: string;
  severity: TicketSeverity;
  blocking: boolean;
  status: TicketStatus;
  createdBy: string;
  assignedAdmin: string | null;
  pageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TicketReplyRow = {
  id: string;
  ticketId: string;
  author: string;
  body: string;
  internalNote: boolean;
  createdAt: string;
};

function rowToTicket(t: Record<string, any>): TicketRow {
  return {
    id: t.id,
    ticketNumber: t.ticket_number,
    draftId: t.draft_id,
    sectionKey: t.section_key,
    type: t.type,
    subject: t.subject,
    description: t.description,
    severity: t.severity,
    blocking: t.blocking,
    status: t.status,
    createdBy: t.created_by,
    assignedAdmin: t.assigned_admin,
    pageUrl: t.page_url,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

/** Tickets for one draft (RLS-scoped: the filer sees their own, an admin
 *  sees all). Used on the review workspace itself. */
export async function getTicketsForDraft(draftId: string): Promise<TicketRow[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("review_tickets")
    .select("*")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(rowToTicket);
}

/** One ticket + its reply thread (RLS-scoped — internal notes are hidden
 *  from non-admins automatically). */
export async function getTicketWithReplies(
  ticketId: string
): Promise<{ ticket: TicketRow; replies: TicketReplyRow[] } | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;
  const { data: ticket } = await supabase.from("review_tickets").select("*").eq("id", ticketId).maybeSingle();
  if (!ticket) return null;
  const { data: replies } = await supabase
    .from("ticket_replies")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  return {
    ticket: rowToTicket(ticket),
    replies: (replies ?? []).map((r) => ({
      id: r.id,
      ticketId: r.ticket_id,
      author: r.author,
      body: r.body,
      internalNote: r.internal_note,
      createdAt: r.created_at,
    })),
  };
}

// ---- Admin reads (service-role, behind an admin check by the caller) -------

export type AdminDraftRow = DashboardRow & { assignedReviewerId: string | null };

/** Every draft, admin-eye view: status, assignee, tickets, verification
 *  progress — the data behind the admin Review queue / Submitted /
 *  Published tabs. Service-role; caller must have already checked
 *  requireAdmin(). Same per-row shape as getAssignedDrafts() so the two
 *  dashboards can share rendering logic. */
export async function getAdminDraftQueue(): Promise<AdminDraftRow[]> {
  const service = getServiceSupabase();
  if (!service) return [];

  const [{ data: drafts }, { data: allAssignments }, { data: reviewers }] = await Promise.all([
    service.from("gene_page_drafts").select("*"),
    service.from("draft_assignments").select("draft_id, reviewer_id, status, assigned_at"),
    service.from("reviewer_profiles").select("user_id, display_name"),
  ]);
  if (!drafts?.length) return [];

  const nameById = new Map((reviewers ?? []).map((r) => [r.user_id, r.display_name]));
  const assignmentsByDraft = new Map<string, { reviewer_id: string; status: string; assigned_at: string }[]>();
  for (const a of allAssignments ?? []) {
    const list = assignmentsByDraft.get(a.draft_id) ?? [];
    list.push(a);
    assignmentsByDraft.set(a.draft_id, list);
  }

  const rows: AdminDraftRow[] = [];
  for (const draft of drafts) {
    const assignments = assignmentsByDraft.get(draft.id) ?? [];
    // Most recently assigned, active (non-completed) assignment "owns" the row.
    const active = assignments
      .filter((a) => a.status !== "completed" && a.status !== "reassigned")
      .sort((a, b) => (a.assigned_at < b.assigned_at ? 1 : -1))[0];

    const flagCount = Array.isArray(draft.review_flags) ? draft.review_flags.length : 0;
    const { data: resolutions } = await service
      .from("review_flag_resolutions")
      .select("flag_index, status")
      .eq("draft_id", draft.id);
    const unresolved = unresolvedFlagCount(
      flagCount,
      (resolutions ?? []).map((r) => ({ flagIndex: r.flag_index, status: r.status as FlagResolutionStatus }))
    );

    const { data: versions } = await service
      .from("gene_page_versions")
      .select("status")
      .eq("gene_slug", draft.gene_slug);
    const hasPublished = (versions ?? []).some((v) => v.status === "published");
    const wasEverPublished = (versions ?? []).length > 0;

    const { data: tickets } = await service
      .from("review_tickets")
      .select("status, blocking")
      .eq("draft_id", draft.id);
    const ticketRows = (tickets ?? []) as { status: TicketStatus; blocking: boolean }[];
    const blockingTicketCount = countBlockingOpenTickets(ticketRows);

    const { data: sentenceReviews } = await service
      .from("draft_sentence_reviews")
      .select("section_key, sentence_index, status")
      .eq("draft_id", draft.id);
    const reviewedByKey = new Map(
      (sentenceReviews ?? []).map((r) => [`${r.section_key}:${r.sentence_index}`, r.status])
    );
    const content = draftRowToContent(draft);
    const sentenceStates = NARRATIVE_SECTION_KEYS.flatMap((key) => {
      const { sentences } = normalizeSentencedText(content[key]);
      return sentences.map((s, i) => ({
        sourceIds: s.sourceIds,
        status: reviewedByKey.get(`${String(key)}:${i}`) ?? "unreviewed",
      }));
    });
    const progress = verificationProgress(sentenceStates);

    rows.push({
      draftId: draft.id,
      geneSlug: draft.gene_slug,
      geneSymbol: draft.gene_symbol,
      flagCount,
      unresolvedFlags: unresolved,
      updatedAt: draft.last_activity_at ?? draft.generated_at ?? null,
      assignedAt: active?.assigned_at ?? null,
      assignmentStatus: (active?.status ?? "assigned") as "assigned" | "in_progress" | "completed" | "reassigned",
      assignedReviewerId: active?.reviewer_id ?? null,
      assignedReviewerName: active ? nameById.get(active.reviewer_id) ?? undefined : undefined,
      openTicketCount: countOpenTickets(ticketRows),
      blockingTicketCount,
      hasPublishedVersion: hasPublished,
      sentencesVerified: progress.verified,
      sentencesTotal: progress.total,
      reviewState: deriveReviewState({
        hasAssignment: assignments.some((a) => a.status !== "completed" && a.status !== "reassigned"),
        reviewStatus: (draft.review_status ?? "unreviewed") as DraftReviewStatus,
        hasEdits: Boolean(draft.first_opened_at),
      }),
      publicationState: derivePublicationState({ hasPublishedVersion: hasPublished, wasEverPublished }),
    });
  }
  return rows;
}

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

export type AuditLogRow = {
  id: string;
  actor: string | null;
  action: string;
  draftId: string | null;
  reviewerId: string | null;
  ticketId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

/** Most recent audit entries. Service-role, admin-only read — the table has
 *  no RLS policy at all for the anon/authenticated roles (deny-all), so this
 *  MUST use the service-role client; caller must have already checked
 *  requireAdmin(). */
export async function getRecentAuditLog(limit = 100): Promise<AuditLogRow[]> {
  const service = getServiceSupabase();
  if (!service) return [];
  const { data } = await service
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id,
    actor: r.actor,
    action: r.action,
    draftId: r.draft_id,
    reviewerId: r.reviewer_id,
    ticketId: r.ticket_id,
    before: r.before_value,
    after: r.after_value,
    createdAt: r.created_at,
  }));
}

/** Audit entries for ONE draft (its assignment/review/ticket history), with
 *  actor ids resolved to display names for the gene detail page's Activity
 *  tab. Service-role, admin-only — same access rule as getRecentAuditLog. */
export async function getAuditLogForDraft(draftId: string): Promise<(AuditLogRow & { actorName: string | null })[]> {
  const service = getServiceSupabase();
  if (!service) return [];
  const { data } = await service
    .from("audit_log")
    .select("*")
    .eq("draft_id", draftId)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = data ?? [];
  const actorIds = Array.from(new Set(rows.map((r) => r.actor).filter(Boolean)));
  const { data: profiles } = actorIds.length
    ? await service.from("reviewer_profiles").select("user_id, display_name").in("user_id", actorIds)
    : { data: [] as { user_id: string; display_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));
  return rows.map((r) => ({
    id: r.id,
    actor: r.actor,
    actorName: r.actor ? nameById.get(r.actor) ?? r.actor : null,
    action: r.action,
    draftId: r.draft_id,
    reviewerId: r.reviewer_id,
    ticketId: r.ticket_id,
    before: r.before_value,
    after: r.after_value,
    createdAt: r.created_at,
  }));
}

/** All tickets across every draft, for the admin ticket inbox. Service-role —
 *  caller must have already checked requireAdmin(). */
export async function getAllTicketsForAdmin(): Promise<(TicketRow & { geneSymbol: string })[]> {
  const service = getServiceSupabase();
  if (!service) return [];
  const { data: tickets } = await service
    .from("review_tickets")
    .select("*")
    .order("created_at", { ascending: false });
  if (!tickets?.length) return [];

  const draftIds = Array.from(new Set(tickets.map((t) => t.draft_id)));
  const { data: drafts } = await service
    .from("gene_page_drafts")
    .select("id, gene_symbol")
    .in("id", draftIds);
  const symbolById = new Map((drafts ?? []).map((d) => [d.id, d.gene_symbol]));

  return tickets.map((t) => ({ ...rowToTicket(t), geneSymbol: symbolById.get(t.draft_id) ?? "?" }));
}
