"use server";

// Publication actions. There are TWO, because there are two different reviews
// a publication can conclude, and they are not the same process:
//
//   publishOwnReviewAction        — an admin reviewed the gene themselves.
//   publishSubmittedReviewAction  — an admin is dispositioning a reviewer's
//                                   submitted work.
//
// These used to be one action that walked submit -> approve -> publish for
// everyone. For an admin's own review that meant fabricating two events that
// never happened as distinct acts ("Carin submitted", "Carin approved"), and
// any step failing left the draft in an intermediate state that the next
// attempt then refused — so retrying got worse every time.
//
// Both delegate the actual write to publishAction, which owns the atomic RPC,
// the content checks, notifications and the audit trail. Neither duplicates
// any of that.

import { getReviewerSession } from "@/lib/reviewer/session";
import { can } from "@/lib/reviewer/permissions";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import {
  approveReviewAction,
  publishAction,
  requestChangesAction,
  type ActionResult,
} from "@/app/review/actions";
import type { GenePageDraft } from "@/lib/geneResearch/types";
import { draftRowToContent } from "@/lib/reviewer/data";

type PublishResult = ActionResult<{ publishedUrl: string; versionId: string }>;

async function loadDraft(
  draftId: string
): Promise<{ ok: true; draft: Record<string, unknown> } | { ok: false; error: string }> {
  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };
  const { data: draft } = await service
    .from("gene_page_drafts")
    .select("*")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { ok: false, error: "Draft not found." };
  return { ok: true, draft: draft as Record<string, unknown> };
}

/**
 * An admin concluding their OWN review.
 *
 * No approval step, because approval would be the admin agreeing with
 * themselves. This publishes directly with adminOverride — which, verified in
 * publishGate.ts, removes ONLY the "must already be approved" requirement.
 * Every content check (flags resolved, sources cited, verification, no
 * blocking tickets) still runs exactly as it does for anyone else.
 *
 * The publish RPC then records the admin as reviewer and leaves the draft
 * `approved`, so the end state matches what actually happened: one person
 * reviewed it and published it.
 */
export async function publishOwnReviewAction(draftId: string): Promise<PublishResult> {
  const session = await getReviewerSession();
  if (!session || !can(session.profile, "genes.publish")) {
    return { ok: false, error: "You don't have permission to publish." };
  }

  const loaded = await loadDraft(draftId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { draft } = loaded;

  // Refuse to treat someone else's submission as your own review. That work
  // deserves to be judged as theirs, with Request changes available.
  const submittedBy = (draft.submitted_by as string | null) ?? null;
  if (submittedBy && submittedBy !== session.userId) {
    return {
      ok: false,
      error: "This gene was submitted by another reviewer. Review it as their submission instead.",
    };
  }

  return publishAction({
    draftId,
    content: draftRowToContent(draft),
    confirmationChecked: true,
    adminOverride: true,
  });
}

/**
 * An admin publishing a REVIEWER'S submitted work.
 *
 * Approval is a real decision here — one person accepting another's review —
 * so it runs, but only if it has not already happened. A draft left `approved`
 * by an earlier attempt that failed at the final step must be publishable on
 * retry, not refused for being in the state that attempt created.
 *
 * Content is not taken from the caller: publishAction reads the immutable
 * snapshot the reviewer submitted (0026), so what goes live is what they
 * reviewed. The live row is only a fallback for drafts approved before
 * snapshots existed, which RLS had kept read-only to their reviewer.
 */
export async function publishSubmittedReviewAction(draftId: string): Promise<PublishResult> {
  const session = await getReviewerSession();
  if (!session || !can(session.profile, "genes.publish")) {
    return { ok: false, error: "You don't have permission to publish." };
  }

  const loaded = await loadDraft(draftId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { draft } = loaded;

  const status = draft.review_status as string;
  if (status !== "submitted_for_approval" && status !== "approved") {
    return {
      ok: false,
      error: "This gene hasn't been submitted for publication. Refresh to see its current state.",
    };
  }

  const approved = (draft.submitted_content as GenePageDraft | null) ?? draftRowToContent(draft);

  if (status !== "approved") {
    const approval = await approveReviewAction({ draftId, content: approved });
    if (!approval.ok) return approval;
  }

  return publishAction({ draftId, content: approved, confirmationChecked: true });
}

/** Send a reviewer's submission back to them with an explanation. */
export async function requestChangesFromScreenAction(
  draftId: string,
  note: string
): Promise<ActionResult> {
  return requestChangesAction({ draftId, note });
}
