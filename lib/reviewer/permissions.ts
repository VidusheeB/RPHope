// RP Hope portal — capability model ("security clearance").
//
// WHY THIS EXISTS
// ---------------
// Access used to be expressed as literal role comparisons (`role !== "admin"`)
// repeated across ~15 server actions and page files, plus an `adminOnly`
// boolean on each nav item. That works for exactly two roles, because
// "not admin" means one unambiguous thing. The moment a third role exists
// (volunteer), every one of those sites silently grants it reviewer-level
// access — because the checks are written as "deny admins-only things" rather
// than "allow what this person is cleared for". The default is INHERIT, which
// is the wrong default for an access system.
//
// So: roles stay in the database as the coarse label, but nothing in the app
// branches on a role name. Everything branches on a CAPABILITY, and each role
// declares its capabilities in one table below. Adding a role becomes one
// entry here — starting from the empty set and granting up — instead of an
// audit of every call site.
//
// THE TWO RULES
// -------------
// 1. Deny by default. A capability a role does not list is denied. There is no
//    inheritance chain and no "everything except" — admin's grants are written
//    out in full, so reading the table tells you the whole truth.
// 2. Hidden UI is never the security boundary. The nav and dashboards filter
//    on these same capabilities so people don't see doors they can't open, but
//    every page and every server action re-checks server-side against the
//    DB-backed profile. See requireCapability() in ./session.
//
// PUBLISHING
// ----------
// `reviewer_profiles.can_publish` is kept, but it is a RESTRICTION, never a
// grant: a role must first hold the publish capability, and can_publish can
// then withhold it from an individual. A reviewer with can_publish = true
// still cannot publish anything, because the reviewer role does not list a
// publish capability at all. That ordering is what makes "reviewers cannot
// publish" true by construction rather than by remembering to check twice.

export type ReviewerRole = "reviewer" | "admin";

/** Every distinct thing a person can be cleared to do in the portal.
 *  Named `<area>.<action>` so nav/dashboard filtering can group by area. */
export type Capability =
  // --- Gene review -----------------------------------------------------
  /** See and open the gene drafts assigned to you. */
  | "genes.review.assigned"
  /** See every gene draft, assigned or not (the full review queue). */
  | "genes.review.all"
  /** Edit draft content + resolve AI review flags on an open assignment. */
  | "genes.edit"
  /** Mark your own review complete, sending the draft to the publish queue. */
  | "genes.submit"
  /** Accept a submitted draft, or send it back with changes requested. */
  | "genes.approve"
  /** Make an approved version the live public gene page (also needs can_publish). */
  | "genes.publish"
  /** Assign / reassign / unassign drafts. */
  | "genes.assign"
  /** Write the private admin-only note on a gene's review. */
  | "genes.note"

  // --- Tickets ---------------------------------------------------------
  /** File a ticket (gene-specific or general). */
  | "tickets.create"
  /** See your OWN tickets and reply in their threads. */
  | "tickets.view.own"
  /** See everyone's tickets, change status/assignment, write internal notes. */
  | "tickets.manage"

  // --- Stories ---------------------------------------------------------
  /** Read story submissions. NOTE: these rows carry submitter PII
   *  (full_name / email / phone / consent), so this is a real privacy
   *  boundary, not just a feature flag. */
  | "stories.review"
  /** Publish or take down a story (also needs can_publish). */
  | "stories.publish"

  // --- Administration --------------------------------------------------
  /** Invite reviewers, toggle active, change role/permissions. */
  | "reviewers.manage"
  /** Read the cross-portal audit log. */
  | "activity.view";

/** Capabilities that a role grant alone is NOT sufficient for — the person's
 *  `can_publish` flag must ALSO be true. Publishing is the one action with
 *  per-person sign-off in the content-governance model, so it stays separately
 *  revocable without demoting someone's whole role. */
const REQUIRES_CAN_PUBLISH: ReadonlySet<Capability> = new Set<Capability>([
  "genes.publish",
  "stories.publish",
]);

/**
 * The clearance table. Written out in full per role — deliberately NOT
 * `[...REVIEWER_CAPS, ...extra]`, because spreading one role into another
 * recreates the inheritance that made the old boolean model fail: you could
 * no longer tell, by reading, whether a role had something on purpose.
 *
 * To add a role (e.g. "volunteer"): add it to ReviewerRole, add the enum value
 * in Postgres, and add an entry here starting from `[]`. Nothing else in the
 * app needs to change.
 */
export const ROLE_CAPABILITIES: Record<ReviewerRole, readonly Capability[]> = {
  // A reviewer works only on what they've been handed: their own assigned
  // gene drafts, and their own tickets. They never see another reviewer's
  // work, the story queue (PII), the audit log, or any publish control.
  reviewer: [
    "genes.review.assigned",
    "genes.edit",
    "genes.submit",
    "tickets.create",
    "tickets.view.own",
  ],

  // Admins hold everything. Listed explicitly so this array is the complete,
  // readable answer to "what can an admin do" — and so granting a new
  // capability is a deliberate edit rather than something admin picks up for
  // free the moment it's defined.
  admin: [
    "genes.review.assigned",
    "genes.review.all",
    "genes.edit",
    "genes.submit",
    "genes.approve",
    "genes.publish",
    "genes.assign",
    "genes.note",
    "tickets.create",
    "tickets.view.own",
    "tickets.manage",
    "stories.review",
    "stories.publish",
    "reviewers.manage",
    "activity.view",
  ],
};

/** The minimum a caller must know about someone to decide what they may do.
 *  Structurally compatible with ReviewerProfile, but narrowed so pure
 *  capability logic never reaches for unrelated profile fields. */
export type ClearanceSubject = {
  role: ReviewerRole;
  can_publish: boolean;
};

/**
 * Does this person hold this capability?
 *
 * The single choke point every gate in the app goes through — server actions,
 * page guards, nav filtering and dashboard sections all call this, so there is
 * one place to read (and one place to test) for "who can do what".
 */
export function can(subject: ClearanceSubject, capability: Capability): boolean {
  const granted = ROLE_CAPABILITIES[subject.role];
  // An unrecognised role (e.g. a DB enum value this build predates) has no
  // entry, and must fail CLOSED rather than throwing or defaulting to a role.
  if (!granted) return false;
  if (!granted.includes(capability)) return false;
  if (REQUIRES_CAN_PUBLISH.has(capability) && !subject.can_publish) return false;
  return true;
}

/** True only if the subject holds every listed capability. */
export function canAll(subject: ClearanceSubject, capabilities: readonly Capability[]): boolean {
  return capabilities.every((c) => can(subject, c));
}

/** True if the subject holds at least one of the listed capabilities. Used by
 *  nav items that are reachable through more than one clearance (e.g. Tickets
 *  is visible to someone who can see their own OR manage everyone's). */
export function canAny(subject: ClearanceSubject, capabilities: readonly Capability[]): boolean {
  return capabilities.some((c) => can(subject, c));
}

/** The subject's full effective capability set, after the can_publish
 *  restriction is applied. Handy for passing one serialisable value to a
 *  client component instead of the profile itself. */
export function capabilitiesFor(subject: ClearanceSubject): Capability[] {
  return (ROLE_CAPABILITIES[subject.role] ?? []).filter((c) => can(subject, c));
}
