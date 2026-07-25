// Pure derivation of the dashboard status label for a gene draft, from facts
// the data layer gathers. Kept pure so the mapping is unit-testable — same
// reasoning as the file this replaces.

export type DashboardStatus =
  | "Unassigned"
  | "Assigned"
  | "In review"
  | "Changes requested"
  | "Submitted for approval"
  | "Published"
  | "Blocked";

export type DraftReviewStatus =
  | "unreviewed"
  | "submitted_for_approval"
  | "changes_requested"
  | "approved"
  | "rejected";

export function deriveDashboardStatus(input: {
  hasAssignment: boolean;
  reviewStatus: DraftReviewStatus;
  hasPublishedVersion: boolean;
  /** A blocking ticket overrides every other state — nothing can move
   *  forward while one is open, so the queue should say so plainly. */
  hasBlockingTicket: boolean;
  /** Any saved edit since assignment — distinguishes "Assigned" (untouched)
   *  from "In review" (reviewer has started working it). */
  hasEdits: boolean;
}): DashboardStatus {
  if (input.hasBlockingTicket) return "Blocked";
  if (input.hasPublishedVersion && input.reviewStatus !== "changes_requested") return "Published";
  if (input.reviewStatus === "changes_requested") return "Changes requested";
  if (input.reviewStatus === "submitted_for_approval") return "Submitted for approval";
  if (!input.hasAssignment) return "Unassigned";
  if (input.hasEdits) return "In review";
  return "Assigned";
}
