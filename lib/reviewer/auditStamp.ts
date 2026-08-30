// The single source of truth for audit metadata on gene_page_drafts.
//
// Every mutation path (reviewer edit, admin edit, submit, request changes,
// approve, publish) builds its update patch through these helpers so the rules
// cannot drift between call sites. The same invariants are ALSO enforced by a
// database trigger (supabase/migrations/0022_audit_metadata_invariants.sql), so
// a direct PostgREST write or a stale deployed RPC cannot bypass them — these
// helpers are the readable layer, the trigger is the guarantee.
//
// The rules:
//   - a content edit stamps who edited and when there was activity;
//   - approving (or "save and publish") stamps reviewed_by AND reviewed_at;
//   - saving a draft NEVER sets reviewed_at;
//   - moving an approved page back to pending CLEARS reviewed_by/reviewed_at,
//     because the old approval no longer describes the current content;
//   - automated generation is never a reviewer (it writes none of these).

/** Review states that mean "not currently approved". Moving into any of these
 *  invalidates a previous approval. */
// These must match the gene_draft_review_status enum exactly (0002 + 0008):
// unreviewed | approved | rejected | submitted_for_approval | changes_requested.
// There is no 'in_review' — listing one made Postgres reject the UPDATE.
export const PENDING_REVIEW_STATUSES = [
  "unreviewed",
  "submitted_for_approval",
  "changes_requested",
] as const;

export type PendingReviewStatus = (typeof PENDING_REVIEW_STATUSES)[number];

export type AuditStamp = {
  last_edited_by?: string;
  last_activity_at?: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
};

/** Stamp for any successful CONTENT edit: who edited it, and that there was
 *  reviewer activity. Deliberately never touches reviewed_*. */
export function contentEditStamp(userId: string, now = new Date()): AuditStamp {
  return { last_edited_by: userId, last_activity_at: now.toISOString() };
}

/** Stamp for approving, or for an admin "Save and publish". Sets BOTH halves of
 *  the reviewer identity — a reviewed_by without a reviewed_at is the exact
 *  defect this replaces. */
export function approvalStamp(userId: string, now = new Date()): AuditStamp {
  const iso = now.toISOString();
  return {
    last_edited_by: userId,
    last_activity_at: iso,
    reviewed_by: userId,
    reviewed_at: iso,
  };
}

/** Stamp for sending an approved page back to a pending state. The previous
 *  approval described different content, so it is cleared rather than left to
 *  imply the current text was reviewed. */
export function reopenStamp(userId: string, now = new Date()): AuditStamp {
  return {
    last_edited_by: userId,
    last_activity_at: now.toISOString(),
    reviewed_by: null,
    reviewed_at: null,
  };
}

/** True when a patch would leave the row in the broken half-stamped state that
 *  this module exists to prevent. Used by tests and as a defensive assert. */
export function hasInconsistentReviewStamp(patch: {
  review_status?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}): boolean {
  const by = patch.reviewed_by ?? null;
  const at = patch.reviewed_at ?? null;
  if ((by === null) !== (at === null)) return true; // one set, the other not
  if (patch.review_status === "approved" && at === null) return true;
  return false;
}
