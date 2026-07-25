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

export type PublishReadinessInput = {
  draft: GenePageDraft;
  flagCount: number;
  resolutions: { flagIndex: number; status: FlagResolutionStatus }[];
  isAssignedReviewer: boolean;
  reviewerCanPublish: boolean;
  confirmationChecked: boolean;
};

export type PublishReadiness = {
  canPublish: boolean;
  /** Human-readable remaining blockers, shown next to the disabled button. */
  blockers: string[];
};

/**
 * Evaluate every publish precondition, returning the exact remaining blockers.
 * This is the single source of truth used by BOTH the UI (to enable/label the
 * button and explain what's left) and the server action (to re-authorize).
 */
export function evaluatePublishReadiness(input: PublishReadinessInput): PublishReadiness {
  const blockers: string[] = [];

  if (!input.isAssignedReviewer) {
    blockers.push("You are not the reviewer assigned to this draft.");
  }
  if (!input.reviewerCanPublish) {
    blockers.push("Your account does not have publishing permission.");
  }
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
  if (!input.confirmationChecked) {
    blockers.push("Check the final confirmation box to publish.");
  }

  return { canPublish: blockers.length === 0, blockers };
}

/** Next version number for a gene, given its existing versions (published +
 *  archived). Monotonic, starting at 1. */
export function nextVersionNumber(existing: { version_number: number }[]): number {
  if (!existing.length) return 1;
  return Math.max(...existing.map((v) => v.version_number)) + 1;
}
