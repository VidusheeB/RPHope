// Pure derivation of the dashboard status label for an assigned draft, from
// facts the data layer gathers. Kept pure so the mapping is unit-testable.

export type DashboardStatus =
  | "Not started"
  | "Draft in progress"
  | "Ready to publish"
  | "Published"
  | "Changes requested";

export function deriveDashboardStatus(input: {
  assignmentStatus: "assigned" | "in_progress" | "completed";
  hasPublishedVersion: boolean;
  flagCount: number;
  unresolvedFlags: number;
  sectionsComplete: boolean;
  hasEdits: boolean;
  /** An active (non-completed) assignment created after a version was already
   *  published — i.e. this gene is being re-reviewed for changes. */
  reopened: boolean;
}): DashboardStatus {
  if (input.reopened && input.assignmentStatus !== "completed") return "Changes requested";
  if (input.assignmentStatus === "completed" || input.hasPublishedVersion) return "Published";
  if (input.flagCount >= 0 && input.unresolvedFlags === 0 && input.sectionsComplete) {
    return "Ready to publish";
  }
  if (
    input.hasEdits ||
    input.assignmentStatus === "in_progress" ||
    input.unresolvedFlags < input.flagCount
  ) {
    return "Draft in progress";
  }
  return "Not started";
}
