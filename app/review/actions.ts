"use server";

// Reviewer portal server actions. Two clients, used deliberately:
//   - getServerSupabase(): RLS-scoped (anon key + reviewer JWT). Reviewer edits
//     and flag resolutions go through this, so the DATABASE enforces that a
//     reviewer can touch only drafts assigned to them — not just the UI.
//   - getServiceSupabase(): service-role, SERVER-ONLY. Used exclusively for the
//     privileged publish write-plan and admin invite/assign, and ONLY after
//     this code re-derives authorization from the database (never from client
//     input). The service-role key is never returned to the browser.

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabaseServer";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { getReviewerSession } from "@/lib/reviewer/session";
import {
  evaluateSubmissionReadiness,
  evaluateAdminPublishReadiness,
  type FlagResolutionStatus,
} from "@/lib/reviewer/publishGate";
import type { DraftReviewStatus } from "@/lib/reviewer/dashboardStatus";
import { resolveStatusOnEdit, sameSourceIds, type SentenceVerificationStatus } from "@/lib/reviewer/sentenceVerification";
import { countBlockingOpenTickets, type TicketStatus } from "@/lib/reviewer/tickets";
import { notify, notifyAdmins, notifyDraftAssignee } from "@/lib/reviewer/notifications";
import { logAudit } from "@/lib/reviewer/audit";
import type { GenePageDraft } from "@/lib/geneResearch/types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; blockers?: string[] };

/** Save reviewer edits to draft sections. RLS enforces active-assignee. */
export async function saveDraftAction(
  draftId: string,
  patch: Record<string, unknown>
): Promise<ActionResult> {
  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, error: "Not configured." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("gene_page_drafts").update(patch).eq("id", draftId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actor: user.id, action: "draft_content_saved", draftId, after: patch });
  return { ok: true };
}

/** Create/update the reviewer's resolution of one AI review flag. The original
 *  flag text is written immutably; the draft's review_flags array is untouched.
 *  RLS enforces that the reviewer is the active assignee. */
export async function resolveFlagAction(input: {
  draftId: string;
  flagIndex: number;
  originalFlagText: string;
  status: FlagResolutionStatus;
  reviewerNote?: string;
  sectionAffected?: string;
}): Promise<ActionResult> {
  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, error: "Not configured." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("review_flag_resolutions").upsert(
    {
      draft_id: input.draftId,
      flag_index: input.flagIndex,
      original_flag_text: input.originalFlagText,
      status: input.status,
      reviewer_note: input.reviewerNote ?? null,
      section_affected: input.sectionAffected ?? null,
      resolved_by: user.id,
      resolved_at: input.status === "unresolved" ? null : new Date().toISOString(),
    },
    { onConflict: "draft_id,flag_index" }
  );
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actor: user.id,
    action: "flag_resolved",
    draftId: input.draftId,
    after: { flagIndex: input.flagIndex, status: input.status },
  });
  return { ok: true };
}

/** Save one sentence's verification state. RLS enforces active-assignee or
 *  admin (draft_sentence_reviews policies, 0009). Applies the "editing a
 *  verified sentence resets it to unreviewed" rule server-side — the
 *  client applies it too for instant feedback, but this is the real
 *  enforcement point. */
export async function saveSentenceReviewAction(input: {
  draftId: string;
  sectionKey: string;
  sentenceIndex: number;
  originalText: string;
  finalText: string;
  originalSourceIds: string[];
  finalSourceIds: string[];
  requestedStatus: SentenceVerificationStatus;
  reviewerNote?: string;
}): Promise<ActionResult> {
  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, error: "Not configured." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: existing } = await supabase
    .from("draft_sentence_reviews")
    .select("final_text, final_source_ids, status")
    .eq("draft_id", input.draftId)
    .eq("section_key", input.sectionKey)
    .eq("sentence_index", input.sentenceIndex)
    .maybeSingle();

  const textChanged = existing ? existing.final_text !== input.finalText : false;
  const sourceIdsChanged = existing
    ? !sameSourceIds(existing.final_source_ids ?? [], input.finalSourceIds)
    : false;
  const status = resolveStatusOnEdit({
    currentStatus: input.requestedStatus,
    textChanged,
    sourceIdsChanged,
  });

  const { error } = await supabase.from("draft_sentence_reviews").upsert(
    {
      draft_id: input.draftId,
      section_key: input.sectionKey,
      sentence_index: input.sentenceIndex,
      original_text: input.originalText,
      final_text: input.finalText,
      original_source_ids: input.originalSourceIds,
      final_source_ids: input.finalSourceIds,
      status,
      reviewer_note: input.reviewerNote ?? null,
      reviewed_by: status === "unreviewed" ? null : user.id,
      reviewed_at: status === "unreviewed" ? null : new Date().toISOString(),
    },
    { onConflict: "draft_id,section_key,sentence_index" }
  );
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actor: user.id,
    action: "sentence_verification_saved",
    draftId: input.draftId,
    before: existing ? { status: existing.status } : null,
    after: { sectionKey: input.sectionKey, sentenceIndex: input.sentenceIndex, status },
  });
  return { ok: true };
}

/**
 * Reviewer-facing "Submit review" — the ONLY way a reviewer can move a draft
 * forward; they never publish directly. Re-runs the submission gate
 * server-side, then marks the draft submitted_for_approval (read-only for
 * the reviewer from here — see the RLS policy in 0008 — until an admin
 * either publishes it or requests changes).
 */
export async function submitReviewAction(input: {
  draftId: string;
  content: GenePageDraft;
  confirmationChecked: boolean;
}): Promise<ActionResult> {
  const session = await getReviewerSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };

  const { data: draft } = await service
    .from("gene_page_drafts")
    .select("id, gene_symbol, review_flags")
    .eq("id", input.draftId)
    .maybeSingle();
  if (!draft) return { ok: false, error: "Draft not found." };

  const { data: assignment } = await service
    .from("draft_assignments")
    .select("id, status")
    .eq("draft_id", input.draftId)
    .eq("reviewer_id", session.userId)
    .maybeSingle();
  const isAssignedReviewer =
    session.profile.role === "admin" ||
    (Boolean(assignment) && assignment!.status !== "completed");

  const { data: resolutions } = await service
    .from("review_flag_resolutions")
    .select("flag_index, status")
    .eq("draft_id", input.draftId);

  const { data: tickets } = await service
    .from("review_tickets")
    .select("status, blocking")
    .eq("draft_id", input.draftId);
  const openBlockingTicketCount = countBlockingOpenTickets(
    (tickets ?? []) as { status: TicketStatus; blocking: boolean }[]
  );

  const readiness = evaluateSubmissionReadiness({
    draft: input.content,
    flagCount: Array.isArray(draft.review_flags) ? draft.review_flags.length : 0,
    resolutions: (resolutions ?? []).map((r) => ({
      flagIndex: r.flag_index,
      status: r.status as FlagResolutionStatus,
    })),
    isAssignedReviewer,
    confirmationChecked: input.confirmationChecked,
    openBlockingTicketCount,
  });
  if (!readiness.canProceed) {
    return { ok: false, error: "Not ready to submit.", blockers: readiness.blockers };
  }

  const { error: saveErr } = await service
    .from("gene_page_drafts")
    .update({
      ...serializeDraft(input.content),
      review_status: "submitted_for_approval",
      submitted_at: new Date().toISOString(),
      submitted_by: session.userId,
    })
    .eq("id", input.draftId);
  if (saveErr) return { ok: false, error: saveErr.message };

  if (assignment?.id) {
    await service.from("draft_assignments").update({ status: "in_progress" }).eq("id", assignment.id);
  }

  await notifyAdmins({
    actor: session.userId,
    type: "review_submitted",
    title: `${draft.gene_symbol} submitted for approval`,
    href: `/review/${input.draftId}`,
    draftId: input.draftId,
  });
  await logAudit({ actor: session.userId, action: "review_submitted", draftId: input.draftId });

  return { ok: true };
}

/** Admin-only: send a submitted draft back to the reviewer with an
 *  explanation. Re-opens edit access (the RLS policy only locks out
 *  submitted_for_approval/approved, so changes_requested is editable again). */
export async function requestChangesAction(input: {
  draftId: string;
  note: string;
}): Promise<ActionResult> {
  const session = await getReviewerSession();
  if (!session || session.profile.role !== "admin") return { ok: false, error: "Admin only." };
  if (!input.note.trim()) return { ok: false, error: "An explanation is required." };

  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };

  const { data: draft } = await service
    .from("gene_page_drafts")
    .select("gene_symbol")
    .eq("id", input.draftId)
    .maybeSingle();

  const { error } = await service
    .from("gene_page_drafts")
    .update({
      review_status: "changes_requested",
      changes_requested_note: input.note,
      changes_requested_at: new Date().toISOString(),
      changes_requested_by: session.userId,
    })
    .eq("id", input.draftId);
  if (error) return { ok: false, error: error.message };

  await notifyDraftAssignee(input.draftId, {
    actor: session.userId,
    type: "changes_requested",
    title: `Changes requested on ${draft?.gene_symbol ?? "a draft"}`,
    body: input.note,
    href: `/review/${input.draftId}`,
  });
  await logAudit({
    actor: session.userId,
    action: "changes_requested",
    draftId: input.draftId,
    after: { note: input.note },
  });

  revalidatePath("/review");
  return { ok: true };
}

/**
 * Admin-only: Approve & publish. Re-authorizes from the database (admin role
 * + can_publish from reviewer_profiles, and that the draft was actually
 * submitted), re-runs the full publish gate, then — only if every condition
 * passes — archives the previous published version and inserts a new
 * immutable one via the service-role client, marks the draft/assignment
 * completed, and revalidates the public route.
 */
export async function publishAction(input: {
  draftId: string;
  content: GenePageDraft;
  confirmationChecked: boolean;
  adminOverride?: boolean;
}): Promise<ActionResult<{ publishedUrl: string; versionId: string }>> {
  const session = await getReviewerSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (session.profile.role !== "admin") {
    return { ok: false, error: "Only an admin can publish.", blockers: ["Only an admin can publish."] };
  }

  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };

  // Re-derive authorization from the DB — never trust the client.
  const { data: draft } = await service
    .from("gene_page_drafts")
    .select("id, gene_slug, gene_symbol, review_flags, review_status")
    .eq("id", input.draftId)
    .maybeSingle();
  if (!draft) return { ok: false, error: "Draft not found." };

  const { data: assignment } = await service
    .from("draft_assignments")
    .select("id, status")
    .eq("draft_id", input.draftId)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: resolutions } = await service
    .from("review_flag_resolutions")
    .select("flag_index, status")
    .eq("draft_id", input.draftId);

  const { data: tickets } = await service
    .from("review_tickets")
    .select("status, blocking")
    .eq("draft_id", input.draftId);
  const openBlockingTicketCount = countBlockingOpenTickets(
    (tickets ?? []) as { status: TicketStatus; blocking: boolean }[]
  );

  const readiness = evaluateAdminPublishReadiness({
    draft: input.content,
    flagCount: Array.isArray(draft.review_flags) ? draft.review_flags.length : 0,
    resolutions: (resolutions ?? []).map((r) => ({
      flagIndex: r.flag_index,
      status: r.status as FlagResolutionStatus,
    })),
    isAdmin: true, // checked above from the DB-backed session
    adminCanPublish: session.profile.can_publish,
    reviewStatus: (draft.review_status ?? "unreviewed") as DraftReviewStatus,
    confirmationChecked: input.confirmationChecked,
    adminOverride: input.adminOverride,
    openBlockingTicketCount,
  });
  if (!readiness.canProceed) {
    return { ok: false, error: "Not ready to publish.", blockers: readiness.blockers };
  }

  // 1. Persist the latest edits onto the draft (outside the publish txn; the
  //    content published is passed to the RPC directly, so a save failure here
  //    is non-fatal to the atomic publish, but we surface it).
  const { error: saveErr } = await service
    .from("gene_page_drafts")
    .update(serializeDraft(input.content))
    .eq("id", input.draftId);
  if (saveErr) return { ok: false, error: `Could not save latest edits: ${saveErr.message}` };

  // 2. ATOMIC publish. All of {lock, archive prior published, insert new
  //    immutable published, update draft state, complete assignment} happen in
  //    ONE Postgres transaction inside publish_gene_version(); on any failure
  //    the whole thing rolls back and the previously published version stays
  //    published. revalidatePath runs ONLY after the txn commits.
  const { data: published, error: rpcErr } = await service
    .rpc("publish_gene_version", {
      p_draft_id: input.draftId,
      p_gene_slug: draft.gene_slug,
      p_content: input.content,
      p_approver: session.userId,
      p_assignment_id: assignment?.id ?? null,
    })
    .single<{ version_id: string; gene_slug: string }>();

  if (rpcErr || !published) {
    return { ok: false, error: `Publish failed: ${rpcErr?.message ?? "no version returned"}` };
  }

  // 3. Only now that the transaction has committed, revalidate the public route.
  revalidatePath(`/genetic-insights/${published.gene_slug}`);

  await notifyDraftAssignee(input.draftId, {
    actor: session.userId,
    type: "gene_published",
    title: `${draft.gene_symbol} published`,
    href: `/genetic-insights/${published.gene_slug}`,
  });
  await logAudit({
    actor: session.userId,
    action: "draft_published",
    draftId: input.draftId,
    after: { versionId: published.version_id, geneSlug: published.gene_slug },
  });

  return {
    ok: true,
    data: { publishedUrl: `/genetic-insights/${published.gene_slug}`, versionId: published.version_id },
  };
}

/** Map a GenePageDraft to the gene_page_drafts column shape (persisting edits).
 *  Deliberately omits review_flags — the AI-generated flag array is preserved. */
function serializeDraft(d: GenePageDraft): Record<string, unknown> {
  return {
    summary_card: d.summaryCard,
    what_this_gene_means: d.whatThisGeneMeans,
    how_it_may_affect_vision: d.howItMayAffectVision,
    what_is_known: d.whatIsKnown,
    what_is_uncertain: d.whatIsUncertain,
    what_you_can_do_next: d.whatYouCanDoNext,
    questions_for_clinician: d.questionsForClinician,
    for_family_and_caregivers: d.forFamilyAndCaregivers,
    treatment_and_research: d.treatmentAndResearch,
    clinical_trial_summary: d.clinicalTrialSummary,
    research_cards: d.researchCards,
    sources: d.sources,
  };
}

// ---- Admin actions (service-role, admin-only) -----------------------------

type AdminCtx =
  | { ok: false; error: string }
  | { ok: true; session: NonNullable<Awaited<ReturnType<typeof getReviewerSession>>>; service: NonNullable<ReturnType<typeof getServiceSupabase>> };

async function requireAdminService(): Promise<AdminCtx> {
  const session = await getReviewerSession();
  if (!session || session.profile.role !== "admin") {
    return { ok: false, error: "Admin only." };
  }
  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };
  return { ok: true, session, service };
}

/** Invite a reviewer by email (invite-only). Sends a Supabase Auth invitation
 *  (the reviewer sets their OWN password from the invite link) and creates
 *  their reviewer_profiles row. Admin + server-only. */
export async function inviteReviewerAction(input: {
  email: string;
  displayName: string;
  role: "reviewer" | "admin";
  canPublish: boolean;
}): Promise<ActionResult> {
  const ctx = await requireAdminService();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/review/set-password`;
  const { data, error } = await ctx.service.auth.admin.inviteUserByEmail(input.email, { redirectTo });
  if (error) return { ok: false, error: error.message };

  const userId = data.user?.id;
  if (userId) {
    const { error: profileErr } = await ctx.service.from("reviewer_profiles").upsert({
      user_id: userId,
      display_name: input.displayName,
      role: input.role,
      can_publish: input.canPublish,
      active: true,
    });
    if (profileErr) return { ok: false, error: profileErr.message };
  }
  await logAudit({
    actor: ctx.session.userId,
    action: "reviewer_invited",
    reviewerId: userId,
    after: { email: input.email, role: input.role, canPublish: input.canPublish },
  });
  return { ok: true };
}

/** Assign a draft to a reviewer. Admin + server-only. */
export async function assignDraftAction(input: {
  draftId: string;
  reviewerId: string;
}): Promise<ActionResult> {
  const ctx = await requireAdminService();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const { error } = await ctx.service.from("draft_assignments").upsert(
    {
      draft_id: input.draftId,
      reviewer_id: input.reviewerId,
      assigned_by: ctx.session.userId,
      status: "assigned",
    },
    { onConflict: "draft_id,reviewer_id" }
  );
  if (error) return { ok: false, error: error.message };

  const { data: draft } = await ctx.service
    .from("gene_page_drafts")
    .select("gene_symbol")
    .eq("id", input.draftId)
    .maybeSingle();
  await notify({
    recipient: input.reviewerId,
    actor: ctx.session.userId,
    type: "draft_assigned",
    title: `You've been assigned ${draft?.gene_symbol ?? "a gene draft"}`,
    href: `/review/${input.draftId}`,
    draftId: input.draftId,
  });
  await logAudit({
    actor: ctx.session.userId,
    action: "draft_assigned",
    draftId: input.draftId,
    reviewerId: input.reviewerId,
  });

  return { ok: true };
}

/** Enable/disable a reviewer account, or change publishing permission. Admin. */
export async function updateReviewerAction(input: {
  userId: string;
  active?: boolean;
  canPublish?: boolean;
}): Promise<ActionResult> {
  const ctx = await requireAdminService();
  if (!ctx.ok) return { ok: false, error: ctx.error };
  const patch: Record<string, unknown> = {};
  if (typeof input.active === "boolean") patch.active = input.active;
  if (typeof input.canPublish === "boolean") patch.can_publish = input.canPublish;
  const { error } = await ctx.service.from("reviewer_profiles").update(patch).eq("user_id", input.userId);
  if (error) return { ok: false, error: error.message };

  if (typeof input.active === "boolean") {
    await logAudit({
      actor: ctx.session.userId,
      action: input.active ? "reviewer_activated" : "reviewer_deactivated",
      reviewerId: input.userId,
    });
  }
  if (typeof input.canPublish === "boolean") {
    await logAudit({
      actor: ctx.session.userId,
      action: "reviewer_publish_permission_changed",
      reviewerId: input.userId,
      after: { canPublish: input.canPublish },
    });
  }
  return { ok: true };
}
