import { describe, it, expect } from "vitest";
import {
  can,
  canAll,
  canAny,
  capabilitiesFor,
  ROLE_CAPABILITIES,
  type Capability,
  type ClearanceSubject,
} from "@/lib/reviewer/permissions";

const reviewer = (over: Partial<ClearanceSubject> = {}): ClearanceSubject => ({
  role: "reviewer",
  can_publish: false,
  ...over,
});
const admin = (over: Partial<ClearanceSubject> = {}): ClearanceSubject => ({
  role: "admin",
  can_publish: true,
  ...over,
});

describe("clearance — what a reviewer may do", () => {
  it("covers exactly the assigned-gene + own-ticket workflow, and nothing else", () => {
    // A snapshot of the reviewer's whole clearance. This is deliberately an
    // exact-set assertion rather than a handful of spot checks: the failure
    // mode this file exists to catch is a capability SILENTLY WIDENING, and a
    // spot check only catches the grants someone thought to test for. If this
    // list changes, it must change on purpose.
    expect(new Set(capabilitiesFor(reviewer()))).toEqual(
      new Set<Capability>([
        "genes.review.assigned",
        "genes.edit",
        "genes.submit",
        "tickets.create",
        "tickets.view.own",
      ])
    );
  });

  it("cannot reach anyone else's work, the audit log, or reviewer management", () => {
    const r = reviewer();
    expect(can(r, "genes.review.all")).toBe(false);
    expect(can(r, "tickets.manage")).toBe(false);
    expect(can(r, "activity.view")).toBe(false);
    expect(can(r, "reviewers.manage")).toBe(false);
  });

  it("cannot approve its own review — approval is a separate authority", () => {
    // The whole point of submit-then-approve: a reviewer hands work to the
    // publish queue but never dispositions it.
    expect(can(reviewer(), "genes.approve")).toBe(false);
  });

  it("cannot read story submissions (they carry submitter PII)", () => {
    // This is the exact hole the old requireReviewer() gate left open: any
    // active profile could read full_name / email / phone / consent.
    expect(can(reviewer(), "stories.review")).toBe(false);
    expect(can(reviewer(), "stories.publish")).toBe(false);
  });
});

describe("clearance — publishing", () => {
  it("a reviewer can NEVER publish, even with can_publish switched on", () => {
    // The ordering rule: can_publish is a restriction on a capability the role
    // already holds, never a grant of one. Flipping the flag on a reviewer
    // must be inert — otherwise the flag becomes a back door to publish
    // authority without a role change.
    const trusted = reviewer({ can_publish: true });
    expect(can(trusted, "genes.publish")).toBe(false);
    expect(can(trusted, "stories.publish")).toBe(false);
  });

  it("an admin with can_publish off keeps everything except publishing", () => {
    const restricted = admin({ can_publish: false });
    expect(can(restricted, "genes.publish")).toBe(false);
    expect(can(restricted, "stories.publish")).toBe(false);
    // ...but is still fully an admin otherwise.
    expect(can(restricted, "genes.approve")).toBe(true);
    expect(can(restricted, "genes.review.all")).toBe(true);
    expect(can(restricted, "stories.review")).toBe(true);
    expect(can(restricted, "reviewers.manage")).toBe(true);
  });

  it("an admin with can_publish on may publish", () => {
    expect(can(admin(), "genes.publish")).toBe(true);
    expect(can(admin(), "stories.publish")).toBe(true);
  });

  it("capabilitiesFor() reflects the can_publish restriction, not just the role table", () => {
    // Nav and dashboards render from this list, so it has to be the effective
    // set — a Publish link must not appear for an admin whose flag is off.
    expect(capabilitiesFor(admin({ can_publish: false }))).not.toContain("genes.publish");
    expect(capabilitiesFor(admin())).toContain("genes.publish");
  });
});

describe("clearance — fails closed", () => {
  it("an unknown role gets nothing rather than defaulting to a known role", () => {
    // Guards the volunteer case: if the DB enum gains a value this build
    // doesn't know, that account must land on zero access, not inherit
    // reviewer's. Cast because the point is a value outside the union.
    const unknown = { role: "volunteer", can_publish: true } as unknown as ClearanceSubject;
    expect(capabilitiesFor(unknown)).toEqual([]);
    expect(can(unknown, "genes.review.assigned")).toBe(false);
    expect(can(unknown, "genes.publish")).toBe(false);
    expect(can(unknown, "stories.review")).toBe(false);
  });

  it("every role's grants are written out in full, with no shared mutable array", () => {
    // Roles must not alias one another's arrays — a spread/reference bug there
    // would make one role's edit silently change another's.
    expect(ROLE_CAPABILITIES.reviewer).not.toBe(ROLE_CAPABILITIES.admin);
  });
});

describe("clearance — admin is a strict superset of reviewer", () => {
  it("holds everything a reviewer holds", () => {
    // An admin must never be MISSING something a reviewer can do, or the
    // portal would show an admin fewer controls than their own reviewers.
    for (const capability of ROLE_CAPABILITIES.reviewer) {
      expect(can(admin(), capability)).toBe(true);
    }
  });
});

describe("canAll / canAny", () => {
  it("canAll requires every capability", () => {
    expect(canAll(reviewer(), ["genes.edit", "genes.submit"])).toBe(true);
    expect(canAll(reviewer(), ["genes.edit", "genes.publish"])).toBe(false);
  });

  it("canAny requires at least one — how multi-clearance nav items resolve", () => {
    // Tickets is reachable by a reviewer (own) or an admin (manage).
    expect(canAny(reviewer(), ["tickets.view.own", "tickets.manage"])).toBe(true);
    expect(canAny(admin(), ["tickets.view.own", "tickets.manage"])).toBe(true);
    expect(canAny(reviewer(), ["activity.view", "reviewers.manage"])).toBe(false);
  });

  it("empty lists behave sensibly", () => {
    expect(canAll(reviewer(), [])).toBe(true);
    expect(canAny(reviewer(), [])).toBe(false);
  });
});
