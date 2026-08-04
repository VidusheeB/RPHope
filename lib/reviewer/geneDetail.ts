// Rich, single-gene read for the unified admin gene-detail page
// (/review/admin/genes/[draftId]) — everything the header, summary panel,
// and all five tabs need, fetched once server-side rather than per-tab.
// Service-role + admin-only (caller must have already checked
// requireAdmin()) since this reads assignment history, reviewer identities,
// and version history that reviewers never see in aggregate.

import { getServiceSupabase } from "../supabaseAdmin";
import { getGene } from "../genes";
import { normalizeSentencedText, NARRATIVE_SECTION_KEYS } from "../geneResearch/types";
import type { GenePageDraft } from "../geneResearch/types";
import { verificationProgress } from "./sentenceVerification";
import { requiredSectionsComplete, unresolvedFlagCount, type FlagResolutionStatus } from "./publishGate";
import {
  deriveReviewState,
  derivePublicationState,
  type ReviewState,
  type PublicationState,
  type DraftReviewStatus,
} from "./dashboardStatus";
import { countBlockingOpenTickets, countOpenTickets, type TicketStatus } from "./tickets";
import { draftRowToContent, type FlagResolutionRow, type TicketRow } from "./data";

export type AssignmentHistoryRow = {
  id: string;
  reviewerId: string;
  reviewerName: string;
  assignedById: string | null;
  assignedByName: string | null;
  assignedAt: string;
  completedAt: string | null;
  status: "assigned" | "in_progress" | "completed" | "reassigned";
};

export type GeneVersionRow = {
  id: string;
  versionNumber: number;
  status: "published" | "archived";
  sourceDraftId: string | null;
  approvedById: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  unpublishedAt: string | null;
  unpublishedByName: string | null;
  createdAt: string;
};

export type GeneAdminDetail = {
  draftId: string;
  geneSlug: string;
  geneSymbol: string;
  fullName: string | null;
  content: GenePageDraft;
  reviewFlags: string[];
  resolutions: FlagResolutionRow[];
  sectionsComplete: boolean;
  adminNote: string | null;

  reviewStatus: DraftReviewStatus;
  reviewState: ReviewState;
  publicationState: PublicationState;

  changesRequestedNote: string | null;
  changesRequestedAt: string | null;
  changesRequestedByName: string | null;

  activeAssignment: AssignmentHistoryRow | null;
  assignmentHistory: AssignmentHistoryRow[];

  firstOpenedAt: string | null;
  lastActivityAt: string | null;
  submittedAt: string | null;
  submittedByName: string | null;
  approvedAt: string | null;
  approvedByName: string | null;

  versions: GeneVersionRow[];
  currentPublishedVersion: GeneVersionRow | null;
  mostRecentUnpublish: GeneVersionRow | null;

  sentencesVerified: number;
  sentencesTotal: number;
  unresolvedBlockingFlags: number;
  unresolvedNonBlockingFlags: number;

  tickets: TicketRow[];
  openTicketCount: number;
  blockingTicketCount: number;
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

export async function getGeneAdminDetail(draftId: string): Promise<GeneAdminDetail | null> {
  const service = getServiceSupabase();
  if (!service) return null;

  const { data: draft } = await service.from("gene_page_drafts").select("*").eq("id", draftId).maybeSingle();
  if (!draft) return null;

  const [{ data: assignments }, { data: versions }, { data: tickets }, { data: sentenceReviews }, { data: resolutions }] =
    await Promise.all([
      service
        .from("draft_assignments")
        .select("id, reviewer_id, assigned_by, assigned_at, completed_at, status")
        .eq("draft_id", draftId)
        .order("assigned_at", { ascending: false }),
      service
        .from("gene_page_versions")
        .select("id, version_number, status, source_draft_id, approved_by, approved_at, published_at, unpublished_at, unpublished_by, created_at")
        .eq("gene_slug", draft.gene_slug)
        .order("version_number", { ascending: false }),
      service.from("review_tickets").select("*").eq("draft_id", draftId).order("created_at", { ascending: false }),
      service.from("draft_sentence_reviews").select("section_key, sentence_index, status").eq("draft_id", draftId),
      service.from("review_flag_resolutions").select("flag_index, original_flag_text, status, reviewer_note, section_affected").eq("draft_id", draftId),
    ]);

  // Batch-resolve every user id referenced anywhere in this gene's history
  // into a display name, one query instead of one per field.
  const userIds = new Set<string>();
  for (const a of assignments ?? []) {
    userIds.add(a.reviewer_id);
    if (a.assigned_by) userIds.add(a.assigned_by);
  }
  for (const v of versions ?? []) {
    if (v.approved_by) userIds.add(v.approved_by);
    if (v.unpublished_by) userIds.add(v.unpublished_by);
  }
  if (draft.submitted_by) userIds.add(draft.submitted_by);
  if (draft.reviewed_by) userIds.add(draft.reviewed_by);
  if (draft.changes_requested_by) userIds.add(draft.changes_requested_by);

  const { data: profiles } = userIds.size
    ? await service.from("reviewer_profiles").select("user_id, display_name").in("user_id", Array.from(userIds))
    : { data: [] as { user_id: string; display_name: string }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

  const assignmentHistory: AssignmentHistoryRow[] = (assignments ?? []).map((a) => ({
    id: a.id,
    reviewerId: a.reviewer_id,
    reviewerName: nameById.get(a.reviewer_id) ?? a.reviewer_id,
    assignedById: a.assigned_by,
    assignedByName: a.assigned_by ? nameById.get(a.assigned_by) ?? a.assigned_by : null,
    assignedAt: a.assigned_at,
    completedAt: a.completed_at,
    status: a.status,
  }));
  const activeAssignment =
    assignmentHistory.find((a) => a.status !== "completed" && a.status !== "reassigned") ?? null;

  const versionRows: GeneVersionRow[] = (versions ?? []).map((v) => ({
    id: v.id,
    versionNumber: v.version_number,
    status: v.status,
    sourceDraftId: v.source_draft_id,
    approvedById: v.approved_by,
    approvedByName: v.approved_by ? nameById.get(v.approved_by) ?? v.approved_by : null,
    approvedAt: v.approved_at,
    publishedAt: v.published_at,
    unpublishedAt: v.unpublished_at,
    unpublishedByName: v.unpublished_by ? nameById.get(v.unpublished_by) ?? v.unpublished_by : null,
    createdAt: v.created_at,
  }));
  const currentPublishedVersion = versionRows.find((v) => v.status === "published") ?? null;
  const mostRecentUnpublish =
    versionRows
      .filter((v) => v.unpublishedAt)
      .sort((a, b) => (b.unpublishedAt! > a.unpublishedAt! ? 1 : -1))[0] ?? null;

  const content = draftRowToContent(draft);
  const reviewFlags = Array.isArray(draft.review_flags) ? (draft.review_flags as string[]) : [];
  const resRows = (resolutions ?? []) as FlagResolutionRow[];
  const reviewedByKey = new Map((sentenceReviews ?? []).map((r) => [`${r.section_key}:${r.sentence_index}`, r.status]));
  const sentenceStates = NARRATIVE_SECTION_KEYS.flatMap((key) => {
    const { sentences } = normalizeSentencedText(content[key]);
    return sentences.map((s, i) => ({
      sourceIds: s.sourceIds,
      status: reviewedByKey.get(`${String(key)}:${i}`) ?? "unreviewed",
    }));
  });
  const progress = verificationProgress(sentenceStates);

  const ticketRows = (tickets ?? []).map(rowToTicket);
  const ticketStatusRows = ticketRows.map((t) => ({ status: t.status as TicketStatus, blocking: t.blocking }));

  return {
    draftId: draft.id,
    geneSlug: draft.gene_slug,
    geneSymbol: draft.gene_symbol,
    fullName: getGene(draft.gene_slug)?.fullName ?? null,
    content,
    reviewFlags,
    resolutions: resRows,
    sectionsComplete: requiredSectionsComplete(content),
    adminNote: draft.admin_note ?? null,

    reviewStatus: (draft.review_status ?? "unreviewed") as DraftReviewStatus,
    reviewState: deriveReviewState({
      hasAssignment: Boolean(activeAssignment),
      reviewStatus: (draft.review_status ?? "unreviewed") as DraftReviewStatus,
      hasEdits: Boolean(draft.first_opened_at),
    }),
    publicationState: derivePublicationState({
      hasPublishedVersion: Boolean(currentPublishedVersion),
      wasEverPublished: versionRows.length > 0,
    }),

    changesRequestedNote: draft.changes_requested_note ?? null,
    changesRequestedAt: draft.changes_requested_at ?? null,
    changesRequestedByName: draft.changes_requested_by ? nameById.get(draft.changes_requested_by) ?? draft.changes_requested_by : null,

    activeAssignment,
    assignmentHistory,

    firstOpenedAt: draft.first_opened_at ?? null,
    lastActivityAt: draft.last_activity_at ?? null,
    submittedAt: draft.submitted_at ?? null,
    submittedByName: draft.submitted_by ? nameById.get(draft.submitted_by) ?? draft.submitted_by : null,
    approvedAt: draft.review_status === "approved" || currentPublishedVersion ? draft.reviewed_at ?? null : draft.reviewed_at ?? null,
    approvedByName: draft.reviewed_by ? nameById.get(draft.reviewed_by) ?? draft.reviewed_by : null,

    versions: versionRows,
    currentPublishedVersion,
    mostRecentUnpublish,

    sentencesVerified: progress.verified,
    sentencesTotal: progress.total,
    unresolvedBlockingFlags: unresolvedFlagCount(
      reviewFlags.length,
      resRows.map((r) => ({ flagIndex: r.flag_index, status: r.status }))
    ),
    unresolvedNonBlockingFlags: 0, // review_flags has no severity field yet — all treated as blocking-until-resolved

    tickets: ticketRows,
    openTicketCount: countOpenTickets(ticketStatusRows),
    blockingTicketCount: countBlockingOpenTickets(ticketStatusRows),
  };
}
