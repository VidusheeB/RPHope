// Pure derivation of a gene draft's REVIEW state and PUBLICATION state, kept
// as two entirely separate concepts per RP Hope Admin's core rule: a gene's
// public publication state must never be inferred from review/verification
// progress, and vice versa. The two used to be merged into one
// `DashboardStatus` enum (a single "Published" branch short-circuited over
// everything else), which is exactly why a published gene with a new draft
// actively in review looked identical to one nobody had touched — the
// bug this file now exists to prevent from recurring.
//
// Kept pure (no network/React) so both derivations are unit-testable in
// isolation and reusable server- and client-side.

export type ReviewState =
  | "unassigned"
  | "assigned"
  | "in_progress"
  | "submitted"
  | "changes_requested"
  | "approved";

export type PublicationState = "draft" | "published" | "unpublished";

export type DraftReviewStatus =
  | "unreviewed"
  | "submitted_for_approval"
  | "changes_requested"
  | "approved"
  | "rejected";

export function deriveReviewState(input: {
  hasAssignment: boolean;
  reviewStatus: DraftReviewStatus;
  /** Meaningful reviewer activity since assignment (first_opened_at or a
   *  real edit) — distinguishes "Assigned" (untouched) from "In progress". */
  hasEdits: boolean;
}): ReviewState {
  if (input.reviewStatus === "changes_requested") return "changes_requested";
  if (input.reviewStatus === "submitted_for_approval") return "submitted";
  if (input.reviewStatus === "approved") return "approved";
  if (!input.hasAssignment) return "unassigned";
  if (input.hasEdits) return "in_progress";
  return "assigned";
}

export function derivePublicationState(input: {
  hasPublishedVersion: boolean;
  /** True when an archived (previously published) gene_page_versions row
   *  exists for this gene, even though nothing is published right now —
   *  the difference between "never published" (draft) and "was published,
   *  then taken down" (unpublished). */
  wasEverPublished: boolean;
}): PublicationState {
  if (input.hasPublishedVersion) return "published";
  if (input.wasEverPublished) return "unpublished";
  return "draft";
}

export const REVIEW_STATE_LABELS: Record<ReviewState, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  in_progress: "In progress",
  submitted: "Submitted",
  changes_requested: "Changes requested",
  approved: "Approved",
};

export const PUBLICATION_STATE_LABELS: Record<PublicationState, string> = {
  draft: "Draft",
  published: "Published",
  unpublished: "Unpublished",
};
