// Pure, dependency-free publish-gating logic for the reviewer portal. No
// network, no Supabase, no React — so every rule the "Approve & Publish" button
// depends on is unit-testable in isolation, and the SAME function is re-run
// server-side inside the publish action (never trusting the client's own
// enable/disable state).
//
// The button is enabled ONLY when every blocker below is clear:
//   - all required sections complete;
//   - all review flags resolved;
//   - the draft passes schema validation;
//   - every cited source ID is present in the draft's own sources registry;
//   - the current user is the assigned reviewer;
//   - reviewer_profiles.can_publish = true;
//   - the reviewer checked the final confirmation.

import { validateDraftSchemaOnly, allCitedSourcesPresent } from "../geneResearch/validate";
import { NARRATIVE_SECTION_KEYS, normalizeSentencedText } from "../geneResearch/types";
import type { GenePageDraft } from "../geneResearch/types";
import type { DraftReviewStatus } from "./dashboardStatus";

export type FlagResolutionStatus =
  | "unresolved"
  | "wording_confirmed"
  | "edited_and_resolved"
  | "not_applicable";

/** A resolution is "resolved" when it is anything other than unresolved. */
export function isResolved(status: FlagResolutionStatus): boolean {
  return status !== "unresolved";
}

/** Every AI review flag (0..flagCount-1) must have a resolution row whose
 *  status is not "unresolved". A missing resolution counts as unresolved. */
export function allFlagsResolved(
  flagCount: number,
  resolutions: { flagIndex: number; status: FlagResolutionStatus }[]
): boolean {
  const byIndex = new Map(resolutions.map((r) => [r.flagIndex, r.status]));
  for (let i = 0; i < flagCount; i++) {
    const status = byIndex.get(i);
    if (!status || !isResolved(status)) return false;
  }
  return true;
}

/** Count of still-unresolved flags (missing resolution included). */
export function unresolvedFlagCount(
  flagCount: number,
  resolutions: { flagIndex: number; status: FlagResolutionStatus }[]
): number {
  const byIndex = new Map(resolutions.map((r) => [r.flagIndex, r.status]));
  let n = 0;
  for (let i = 0; i < flagCount; i++) {
    const status = byIndex.get(i);
    if (!status || !isResolved(status)) n++;
  }
  return n;
}

/** True when every required section has real content (at least one non-empty
 *  sentence, at least one clinician question, at least one source). */
export function requiredSectionsComplete(draft: GenePageDraft): boolean {
  for (const field of NARRATIVE_SECTION_KEYS) {
    const { sentences } = normalizeSentencedText(draft[field]);
    if (sentences.length === 0 || sentences.every((s) => s.text.trim().length === 0)) {
      return false;
    }
  }
  if (!draft.questionsForClinician || draft.questionsForClinician.length === 0) return false;
  if (!draft.sources || draft.sources.length === 0) return false;
  return true;
}

export type Readiness = {
  canProceed: boolean;
  /** Human-readable remaining blockers, shown next to the disabled button. */
  blockers: string[];
};

/** Checks shared by both submission and publish: required sections, flags,
 *  schema, cited sources, and any open blocking ticket. Neither reviewer nor
 *  admin can move a draft forward while any of these fail. */
function baseContentBlockers(input: {
  draft: GenePageDraft;
  flagCount: number;
  resolutions: { flagIndex: number; status: FlagResolutionStatus }[];
  openBlockingTicketCount?: number;
}): string[] {
  const blockers: string[] = [];
  if (!requiredSectionsComplete(input.draft)) {
    blockers.push("One or more required sections are still empty.");
  }
  const unresolved = unresolvedFlagCount(input.flagCount, input.resolutions);
  if (unresolved > 0) {
    blockers.push(`${unresolved} review flag${unresolved === 1 ? "" : "s"} still unresolved.`);
  }
  const schema = validateDraftSchemaOnly(input.draft);
  if (!schema.ok) {
    blockers.push(`Draft fails schema validation: ${schema.error}`);
  }
  const sources = allCitedSourcesPresent(input.draft);
  if (!sources.ok) {
    blockers.push(`Cited source ID(s) missing from the sources list: ${sources.missing.join(", ")}`);
  }
  if (input.openBlockingTicketCount) {
    blockers.push(
      `${input.openBlockingTicketCount} blocking ticket${input.openBlockingTicketCount === 1 ? "" : "s"} must be resolved first.`
    );
  }
  return blockers;
}

export type SubmissionReadinessInput = {
  draft: GenePageDraft;
  flagCount: number;
  resolutions: { flagIndex: number; status: FlagResolutionStatus }[];
  isAssignedReviewer: boolean;
  confirmationChecked: boolean;
  openBlockingTicketCount?: number;
};

/**
 * Reviewer-facing gate for "Submit review." Deliberately does NOT check
 * can_publish — reviewers never publish, regardless of that flag; only
 * evaluateAdminPublishReadiness does. Same shared-content-checks pattern as
 * the admin gate below, so both stay in sync automatically.
 */
export function evaluateSubmissionReadiness(input: SubmissionReadinessInput): Readiness {
  const blockers = baseContentBlockers(input);
  if (!input.isAssignedReviewer) {
    blockers.push("You are not the reviewer assigned to this draft.");
  }
  if (!input.confirmationChecked) {
    blockers.push(
      "Check the confirmation box: \"I have reviewed the medical and scientific content against the cited sources and confirm that my review is complete.\""
    );
  }
  return { canProceed: blockers.length === 0, blockers };
}

export type ApprovalReadinessInput = {
  draft: GenePageDraft;
  flagCount: number;
  resolutions: { flagIndex: number; status: FlagResolutionStatus }[];
  isAdmin: boolean;
  /** Approval only ever applies to a draft the reviewer has actually
   *  submitted — never unassigned/in-progress/changes-requested work. */
  reviewStatus: DraftReviewStatus;
  openBlockingTicketCount?: number;
};

/**
 * Admin-only gate for "Approve" — a separate action from Publish. Requires
 * the SAME content-completeness checks Submit/Publish already require
 * (verification/flags/schema/sources/no open blocking tickets), plus the
 * submitted state itself. An earlier version of this action only checked
 * submitted state and skipped all of these — a real gap this closes.
 */
export function evaluateApprovalReadiness(input: ApprovalReadinessInput): Readiness {
  const blockers = baseContentBlockers(input);
  if (!input.isAdmin) {
    blockers.push("Only an admin can approve a review.");
  }
  if (input.reviewStatus !== "submitted_for_approval") {
    blockers.push("This draft hasn't been submitted for approval yet.");
  }
  return { canProceed: blockers.length === 0, blockers };
}

export type AdminPublishReadinessInput = {
  draft: GenePageDraft;
  flagCount: number;
  resolutions: { flagIndex: number; status: FlagResolutionStatus }[];
  isAdmin: boolean;
  adminCanPublish: boolean;
  /** Publishing requires the draft to already be 'approved' — approval is a
   *  separate, prior admin action (see approveReviewAction), never a side
   *  effect of publishing itself. */
  reviewStatus: DraftReviewStatus;
  confirmationChecked: boolean;
  openBlockingTicketCount?: number;
  /** Admins may override the normal "must be approved first" requirement
   *  (spec: "Override normal workflow restrictions when necessary"). */
  adminOverride?: boolean;
};

/**
 * Admin-only gate for "Publish." Reviewers can never reach this — enforced
 * here (isAdmin) AND re-checked server-side in the publish action, never
 * trusted from the client. Requires a PRIOR, separate approval (see
 * approveReviewAction) — approving never auto-publishes.
 */
export function evaluateAdminPublishReadiness(input: AdminPublishReadinessInput): Readiness {
  const blockers = baseContentBlockers(input);
  if (!input.isAdmin) {
    blockers.push("Only an admin can publish.");
  }
  if (!input.adminCanPublish) {
    blockers.push("Your account does not have publishing permission.");
  }
  if (input.reviewStatus !== "approved" && !input.adminOverride) {
    blockers.push("This draft hasn't been approved yet.");
  }
  if (!input.confirmationChecked) {
    blockers.push("Check the final confirmation box to publish.");
  }
  return { canProceed: blockers.length === 0, blockers };
}

/** Next version number for a gene, given its existing versions (published +
 *  archived). Monotonic, starting at 1. */
export function nextVersionNumber(existing: { version_number: number }[]): number {
  if (!existing.length) return 1;
  return Math.max(...existing.map((v) => v.version_number)) + 1;
}
