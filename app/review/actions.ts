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
import { reviewHref } from "@/lib/reviewer/paths";
import type { GenePageDraft } from "@/lib/geneResearch/types";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; blockers?: string[]; data?: T };

/** Save reviewer edits to draft sections. RLS enforces active-assignee.
 *  Deliberately does NOT write an audit-log row here — this fires on every
 *  debounced autosave, and the spec is explicit that autosave keystrokes
 *  must never flood the audit trail or be treated as their own event.
 *  last_activity_at is cheap to update and is what "last reviewer
 *  activity" displays are read from instead. */
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

  const { error } = await supabase
    .from("gene_page_drafts")
    .update({ ...patch, last_activity_at: new Date().toISOString() })
    .eq("id", draftId);
  if (error) return { ok: false, error: error.message };
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

  const submittedAt = new Date().toISOString();
  const { error: saveErr } = await service
    .from("gene_page_drafts")
    .update({
      ...serializeDraft(input.content),
      review_status: "submitted_for_approval",
      submitted_at: submittedAt,
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
    href: reviewHref(`/${input.draftId}`),
    draftId: input.draftId,
    dedupeKey: `review:${input.draftId}:submitted:${submittedAt}`,
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

  const changesRequestedAt = new Date().toISOString();
  const { error } = await service
    .from("gene_page_drafts")
    .update({
      review_status: "changes_requested",
      changes_requested_note: input.note,
      changes_requested_at: changesRequestedAt,
      changes_requested_by: session.userId,
    })
    .eq("id", input.draftId);
  if (error) return { ok: false, error: error.message };

  await notifyDraftAssignee(input.draftId, {
    actor: session.userId,
    type: "changes_requested",
    title: `Changes requested on ${draft?.gene_symbol ?? "a draft"}`,
    body: input.note,
    href: reviewHref(`/${input.draftId}`),
    dedupeKey: `review:${input.draftId}:changes_requested:${changesRequestedAt}`,
  });
  await logAudit({
    actor: session.userId,
    action: "changes_requested",
    draftId: input.draftId,
    after: { note: input.note },
  });

  // revalidatePath targets the actual page/route (app/review/page.tsx),
  // which is the same physical route on both deployments — the
  // rphopereview rewrite changes which EXTERNAL URL reaches it, not the
  // route itself, so this stays hardcoded rather than going through
  // reviewHref() (which is only for URLs a browser will actually navigate to).
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
    dedupeKey: `gene:${published.gene_slug}:published:${published.version_id}`,
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

  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${reviewHref("/set-password")}`;
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
/**
 * Assign or reassign a draft to a reviewer (an admin may assign to
 * themselves too — there is no reviewer/admin exclusivity here).
 *
 * Reassignment away from an existing active assignee is only allowed to
 * proceed silently when that prior assignee has no meaningful activity yet
 * (first_opened_at unset). Once real work exists, the caller must pass
 * `confirmed: true` (the UI shows the exact warning text the spec
 * requires) — the previous assignment is preserved (marked 'reassigned',
 * never deleted), both the outgoing and incoming reviewer are notified,
 * and the draft's own content/edits are completely untouched.
 */
export async function assignDraftAction(input: {
  draftId: string;
  reviewerId: string;
  confirmed?: boolean;
}): Promise<ActionResult<{ requiresConfirmation?: true; warning?: string }>> {
  const ctx = await requireAdminService();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data: draft } = await ctx.service
    .from("gene_page_drafts")
    .select("gene_symbol, first_opened_at")
    .eq("id", input.draftId)
    .maybeSingle();
  if (!draft) return { ok: false, error: "Draft not found." };

  const { data: currentActive } = await ctx.service
    .from("draft_assignments")
    .select("id, reviewer_id, status")
    .eq("draft_id", input.draftId)
    .not("status", "in", "(completed,reassigned)");

  const priorAssignee = (currentActive ?? []).find((a) => a.reviewer_id !== input.reviewerId);
  const isReassignment = Boolean(priorAssignee);
  const hasMeaningfulWork = Boolean(draft.first_opened_at);

  if (isReassignment && hasMeaningfulWork && !input.confirmed) {
    return {
      ok: false,
      error: "Confirmation required.",
      data: {
        requiresConfirmation: true,
        warning:
          "This review already contains work from the current reviewer. Reassigning will preserve the work and transfer responsibility to the new reviewer.",
      },
    };
  }

  if (priorAssignee) {
    await ctx.service
      .from("draft_assignments")
      .update({ status: "reassigned" })
      .eq("id", priorAssignee.id);
  }

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

  const assignedAt = new Date().toISOString();
  await notify({
    recipient: input.reviewerId,
    actor: ctx.session.userId,
    type: "draft_assigned",
    title: `You've been assigned ${draft.gene_symbol}`,
    href: reviewHref(`/${input.draftId}`),
    draftId: input.draftId,
    dedupeKey: `assignment:${input.draftId}:assigned:${input.reviewerId}:${assignedAt}`,
  });
  if (priorAssignee) {
    await notify({
      recipient: priorAssignee.reviewer_id,
      actor: ctx.session.userId,
      type: "draft_assigned",
      title: `${draft.gene_symbol} was reassigned to another reviewer`,
      href: reviewHref(""),
      draftId: input.draftId,
      dedupeKey: `assignment:${input.draftId}:reassigned_away:${priorAssignee.reviewer_id}:${assignedAt}`,
    });
  }
  await logAudit({
    actor: ctx.session.userId,
    action: isReassignment ? "draft_reassigned" : "draft_assigned",
    draftId: input.draftId,
    reviewerId: input.reviewerId,
    before: priorAssignee ? { previousReviewerId: priorAssignee.reviewer_id } : undefined,
  });

  return { ok: true };
}

/** Remove the active assignment from a draft entirely (not a reassignment
 *  — nobody is responsible for it afterward). Preserves the row (marked
 *  'reassigned' — the same "no longer active, never deleted" history
 *  status reassignment uses) rather than deleting it. */
export async function unassignDraftAction(draftId: string): Promise<ActionResult> {
  const ctx = await requireAdminService();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const { data: current } = await ctx.service
    .from("draft_assignments")
    .select("id, reviewer_id")
    .eq("draft_id", draftId)
    .not("status", "in", "(completed,reassigned)");
  if (!current?.length) return { ok: true };

  for (const a of current) {
    await ctx.service.from("draft_assignments").update({ status: "reassigned" }).eq("id", a.id);
    await notify({
      recipient: a.reviewer_id,
      actor: ctx.session.userId,
      type: "draft_assigned",
      title: "An assignment was removed",
      href: reviewHref(""),
      draftId,
    });
  }
  await logAudit({ actor: ctx.session.userId, action: "draft_unassigned", draftId });
  return { ok: true };
}

/**
 * Admin-only: approve a submitted review WITHOUT publishing it. Kept as a
 * separate action from publishAction on purpose (spec: "Approve and
 * Publish are separate actions") — publishing then requires review_status
 * = 'approved' rather than being a side effect of the publish RPC itself.
 */
export async function approveReviewAction(draftId: string): Promise<ActionResult> {
  const session = await getReviewerSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (session.profile.role !== "admin") return { ok: false, error: "Only an admin can approve a review." };

  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };

  const { data: draft } = await service
    .from("gene_page_drafts")
    .select("gene_symbol, review_status")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { ok: false, error: "Draft not found." };
  if (draft.review_status !== "submitted_for_approval") {
    return { ok: false, error: "This draft hasn't been submitted for approval yet." };
  }

  const approvedAt = new Date().toISOString();
  const { error } = await service
    .from("gene_page_drafts")
    .update({ review_status: "approved", reviewed_by: session.userId, reviewed_at: approvedAt })
    .eq("id", draftId);
  if (error) return { ok: false, error: error.message };

  await notifyDraftAssignee(draftId, {
    actor: session.userId,
    type: "review_approved",
    title: `${draft.gene_symbol} was approved`,
    href: reviewHref(`/${draftId}`),
    dedupeKey: `review:${draftId}:approved:${approvedAt}`,
  });
  await logAudit({ actor: session.userId, action: "review_approved", draftId });

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

/** Take a published gene page down. Archives the current published
 *  gene_page_versions row for that slug (not deleted — can be re-published
 *  later). The public route falls back to the legacy genesData.json content
 *  once nothing is published, same as before this gene was ever reviewed.
 *  Admin + can_publish, same bar as publishing in the first place. */
export async function unpublishGeneAction(geneSlug: string): Promise<ActionResult> {
  const session = await getReviewerSession();
  if (!session) return { ok: false, error: "Not signed in." };
  if (session.profile.role !== "admin" || !session.profile.can_publish) {
    return { ok: false, error: "Only an admin with publish permission can take a page down." };
  }
  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };

  const { data: current } = await service
    .from("gene_page_versions")
    .select("id, source_draft_id")
    .eq("gene_slug", geneSlug)
    .eq("status", "published")
    .maybeSingle();
  if (!current) return { ok: false, error: "This gene isn't currently published." };

  const unpublishedAt = new Date().toISOString();
  const { error } = await service
    .from("gene_page_versions")
    .update({ status: "archived", unpublished_at: unpublishedAt, unpublished_by: session.userId })
    .eq("id", current.id);
  if (error) return { ok: false, error: error.message };

  await logAudit({ actor: session.userId, action: "gene_unpublished", after: { geneSlug, versionId: current.id } });
  if (current.source_draft_id) {
    await notifyDraftAssignee(current.source_draft_id, {
      actor: session.userId,
      type: "gene_unpublished",
      title: `${geneSlug.toUpperCase()} was unpublished`,
      href: reviewHref(`/${current.source_draft_id}`),
      dedupeKey: `gene:${geneSlug}:unpublished:${unpublishedAt}`,
    });
  }
  revalidatePath(`/genetic-insights/${geneSlug}`);
  revalidatePath("/review/admin");
  return { ok: true };
}
