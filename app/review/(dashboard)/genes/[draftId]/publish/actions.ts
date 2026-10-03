"use server";

// Publication actions for the admin review-and-publish screen.
//
// Thin wrappers over the existing, already-hardened publishAction /
// requestChangesAction / approveReviewAction rather than a parallel
// implementation: those own the atomic RPC, the readiness gate, notifications
// and the audit trail, and duplicating any of that is how the two paths would
// drift apart.

import { getReviewerSession } from "@/lib/reviewer/session";
import { can } from "@/lib/reviewer/permissions";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import {
  approveReviewAction,
  publishAction,
  requestChangesAction,
  submitReviewAction,
  type ActionResult,
} from "@/app/review/actions";
import type { GenePageDraft } from "@/lib/geneResearch/types";
import { draftRowToContent } from "@/lib/reviewer/data";

/**
 * Publish the reviewer-approved version.
 *
 * The existing gate requires a draft to be `approved` before it can be
 * published, and approval is a separate admin step. From the publication
 * screen an administrator has a single "Publish" button, so this walks both
 * transitions in order — approve, then publish — instead of reaching for the
 * adminOverride escape hatch, which would skip the content checks that
 * approval performs.
 *
 * Content is NOT accepted from the caller. publishAction reads the immutable
 * snapshot taken when the reviewer submitted (see 0026), so what goes live is
 * what was reviewed.
 */
export async function publishApprovedVersionAction(
  draftId: string
): Promise<ActionResult<{ publishedUrl: string; versionId: string }>> {
  const session = await getReviewerSession();
  if (!session || !can(session.profile, "genes.publish")) {
    return { ok: false, error: "You don't have permission to publish." };
  }

  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };

  const { data: draft } = await service
    .from("gene_page_drafts")
    // select("*") so the legacy fallback below can rebuild the draft shape
    // from the live columns when no snapshot exists.
    .select("*")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { ok: false, error: "Draft not found." };

  // Stale-tab guard: another admin may have published or sent this back while
  // this screen was open. Fail cleanly rather than double-publishing.
  if (draft.review_status === "rejected") {
    return { ok: false, error: "This gene was rejected. Reopen it before publishing." };
  }

  // Prefer the immutable snapshot taken when the reviewer submitted (0026).
  //
  // When there is none, fall back to the live draft rather than refusing.
  // A draft approved BEFORE 0026 existed has no snapshot by definition, and a
  // draft still in review has not produced one yet. Refusing both would make a
  // guarantee introduced for future work retroactively block completed work
  // and self-review alike.
  //
  // publishAction independently re-reads the snapshot and prefers it, so the
  // content passed here is only ever used when there genuinely isn't one.
  const approved =
    (draft.submitted_content as GenePageDraft | null) ?? draftRowToContent(draft as Record<string, unknown>);

  // WALK WHATEVER TRANSITIONS ARE OUTSTANDING.
  //
  // An admin reviewing a gene assigned to themselves is doing all three jobs —
  // review, approve, publish — and previously only the last button was
  // offered, gated on an approval nobody was going to perform. Pressing
  // Publish now carries out each remaining step in order, through the same
  // hardened actions, so every transition is gated and audited exactly as it
  // would be if three different people had done it.
  if (draft.review_status !== "submitted_for_approval" && draft.review_status !== "approved") {
    if (!can(session.profile, "genes.submit")) {
      return { ok: false, error: "This gene hasn't been submitted for review yet." };
    }
    const submitted = await submitReviewAction({
      draftId,
      content: approved,
      // The admin ticked the review confirmation in the editor before this
      // button became available; this is that same attestation.
      confirmationChecked: true,
    });
    if (!submitted.ok) return submitted;
  }

  if (!can(session.profile, "genes.approve")) {
    return { ok: false, error: "This gene needs an administrator's approval before it can be published." };
  }
  const approval = await approveReviewAction({ draftId, content: approved });
  if (!approval.ok) return approval;

  return publishAction({
    draftId,
    content: approved,
    confirmationChecked: true,
  });
}

/** Send a submitted gene back to its reviewer with an explanation. */
export async function requestChangesFromScreenAction(
  draftId: string,
  note: string
): Promise<ActionResult> {
  return requestChangesAction({ draftId, note });
}
