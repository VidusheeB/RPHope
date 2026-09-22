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
import { approveReviewAction, publishAction, requestChangesAction, type ActionResult } from "@/app/review/actions";
import type { GenePageDraft } from "@/lib/geneResearch/types";

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
    .select("review_status, submitted_content")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { ok: false, error: "Draft not found." };

  // Stale-tab guard: another admin may have published or sent this back while
  // this screen was open. Fail cleanly rather than double-publishing.
  if (draft.review_status !== "submitted_for_approval" && draft.review_status !== "approved") {
    return {
      ok: false,
      error: "This gene is no longer awaiting publication — another administrator may have acted on it. Refresh to see its current state.",
    };
  }

  const approved = (draft.submitted_content as GenePageDraft | null) ?? null;
  if (!approved) {
    return {
      ok: false,
      error:
        "No approved version is on file for this gene, so there is nothing to publish safely. Send it back to the reviewer to re-approve.",
    };
  }

  if (draft.review_status === "submitted_for_approval") {
    const approval = await approveReviewAction({ draftId, content: approved });
    if (!approval.ok) return approval;
  }

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
