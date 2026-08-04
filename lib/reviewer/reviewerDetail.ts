// Rich single-reviewer read for /review/admin/reviewers/[reviewerId] —
// profile + invitation/account status + active assignments + completed
// review history, all fetched once. Service-role, admin-only (caller must
// have already checked requireAdmin()).

import { getServiceSupabase } from "../supabaseAdmin";
import { deriveReviewState, derivePublicationState, type ReviewState, type PublicationState } from "./dashboardStatus";
import { unresolvedFlagCount, type FlagResolutionStatus } from "./publishGate";
import { verificationProgress } from "./sentenceVerification";
import { normalizeSentencedText, NARRATIVE_SECTION_KEYS } from "../geneResearch/types";
import { draftRowToContent } from "./data";

export type ReviewerAssignmentRow = {
  draftId: string;
  geneSlug: string;
  geneSymbol: string;
  reviewState: ReviewState;
  publicationState: PublicationState;
  assignedAt: string;
  lastActivityAt: string | null;
  sentencesVerified: number;
  sentencesTotal: number;
  openFlags: number;
};

export type ReviewerCompletedRow = {
  draftId: string;
  geneSlug: string;
  geneSymbol: string;
  submittedAt: string | null;
  approvedAt: string | null;
  publicationState: PublicationState;
};

export type ReviewerDetail = {
  userId: string;
  displayName: string;
  email: string | null;
  role: "reviewer" | "admin";
  active: boolean;
  canPublish: boolean;
  title: string | null;
  organization: string | null;
  specialty: string | null;
  adminNotes: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  lastActiveAt: string | null;
  activeAssignments: ReviewerAssignmentRow[];
  completedReviews: ReviewerCompletedRow[];
  completedCount: number;
};

export async function getReviewerDetail(userId: string): Promise<ReviewerDetail | null> {
  const service = getServiceSupabase();
  if (!service) return null;

  const { data: profile } = await service
    .from("reviewer_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return null;

  const { data: authUser } = await service.auth.admin.getUserById(userId);

  const { data: assignments } = await service
    .from("draft_assignments")
    .select("id, draft_id, assigned_at, status")
    .eq("reviewer_id", userId)
    .order("assigned_at", { ascending: false });

  const draftIds = Array.from(new Set((assignments ?? []).map((a) => a.draft_id)));
  const { data: drafts } = draftIds.length
    ? await service.from("gene_page_drafts").select("*").in("id", draftIds)
    : { data: [] as any[] };
  const draftById = new Map((drafts ?? []).map((d) => [d.id, d]));

  const geneSlugs = Array.from(new Set((drafts ?? []).map((d) => d.gene_slug)));
  const { data: versions } = geneSlugs.length
    ? await service.from("gene_page_versions").select("gene_slug, status").in("gene_slug", geneSlugs)
    : { data: [] as { gene_slug: string; status: string }[] };
  const publishedSlugs = new Set((versions ?? []).filter((v) => v.status === "published").map((v) => v.gene_slug));
  const everPublishedSlugs = new Set((versions ?? []).map((v) => v.gene_slug));

  const { data: allResolutions } = draftIds.length
    ? await service.from("review_flag_resolutions").select("draft_id, flag_index, status").in("draft_id", draftIds)
    : { data: [] as any[] };
  const { data: allSentenceReviews } = draftIds.length
    ? await service.from("draft_sentence_reviews").select("draft_id, section_key, sentence_index, status").in("draft_id", draftIds)
    : { data: [] as any[] };

  const activeAssignments: ReviewerAssignmentRow[] = [];
  const completedReviews: ReviewerCompletedRow[] = [];

  for (const a of assignments ?? []) {
    const draft = draftById.get(a.draft_id);
    if (!draft) continue;
    const publicationState = derivePublicationState({
      hasPublishedVersion: publishedSlugs.has(draft.gene_slug),
      wasEverPublished: everPublishedSlugs.has(draft.gene_slug),
    });

    if (a.status === "completed" || a.status === "reassigned") {
      completedReviews.push({
        draftId: draft.id,
        geneSlug: draft.gene_slug,
        geneSymbol: draft.gene_symbol,
        submittedAt: draft.submitted_at ?? null,
        approvedAt: draft.review_status === "approved" ? draft.reviewed_at ?? null : null,
        publicationState,
      });
      continue;
    }

    const flagCount = Array.isArray(draft.review_flags) ? draft.review_flags.length : 0;
    const resolutions = (allResolutions ?? []).filter((r) => r.draft_id === a.draft_id);
    const openFlags = unresolvedFlagCount(
      flagCount,
      resolutions.map((r) => ({ flagIndex: r.flag_index, status: r.status as FlagResolutionStatus }))
    );

    const content = draftRowToContent(draft);
    const reviewedByKey = new Map(
      (allSentenceReviews ?? [])
        .filter((r) => r.draft_id === a.draft_id)
        .map((r) => [`${r.section_key}:${r.sentence_index}`, r.status])
    );
    const sentenceStates = NARRATIVE_SECTION_KEYS.flatMap((key) => {
      const { sentences } = normalizeSentencedText(content[key]);
      return sentences.map((s, i) => ({
        sourceIds: s.sourceIds,
        status: reviewedByKey.get(`${String(key)}:${i}`) ?? "unreviewed",
      }));
    });
    const progress = verificationProgress(sentenceStates);

    activeAssignments.push({
      draftId: draft.id,
      geneSlug: draft.gene_slug,
      geneSymbol: draft.gene_symbol,
      reviewState: deriveReviewState({
        hasAssignment: true,
        reviewStatus: draft.review_status ?? "unreviewed",
        hasEdits: Boolean(draft.first_opened_at),
      }),
      publicationState,
      assignedAt: a.assigned_at,
      lastActivityAt: draft.last_activity_at ?? null,
      sentencesVerified: progress.verified,
      sentencesTotal: progress.total,
      openFlags,
    });
  }

  return {
    userId: profile.user_id,
    displayName: profile.display_name,
    email: authUser?.user?.email ?? null,
    role: profile.role,
    active: profile.active,
    canPublish: profile.can_publish,
    title: profile.title ?? null,
    organization: profile.organization ?? null,
    specialty: profile.specialty ?? null,
    adminNotes: profile.admin_notes ?? null,
    invitedAt: profile.invited_at ?? authUser?.user?.created_at ?? null,
    acceptedAt: authUser?.user?.last_sign_in_at ?? null,
    lastActiveAt: profile.last_active_at ?? null,
    activeAssignments,
    completedReviews,
    completedCount: completedReviews.length,
  };
}
