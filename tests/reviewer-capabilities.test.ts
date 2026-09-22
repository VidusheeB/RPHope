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

  it("cannot reach anyone else's work, the audit log, or team management", () => {
    const r = reviewer();
    expect(can(r, "genes.review.all")).toBe(false);
    expect(can(r, "tickets.manage")).toBe(false);
    expect(can(r, "activity.view")).toBe(false);
    expect(can(r, "team.manage")).toBe(false);
    expect(can(r, "team.view")).toBe(false);
  });

  it("cannot reach the organisation surfaces", () => {
    // Donations and analytics are explicitly out of scope for a reviewer
    // (spec: reviewer must NOT see donor information or analytics).
    const r = reviewer();
    expect(can(r, "donations.view")).toBe(false);
    expect(can(r, "analytics.view")).toBe(false);
    expect(can(r, "website.edit")).toBe(false);
    expect(can(r, "website.publish")).toBe(false);
    expect(can(r, "genes.generate")).toBe(false);
    expect(can(r, "genes.assign")).toBe(false);
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
    // The reviewer role holds no publish capability at all, so the legacy
    // column cannot become a back door to publish authority without a role
    // change. This is the assertion that must never be relaxed.
    const trusted = reviewer({ can_publish: true });
    expect(can(trusted, "genes.publish")).toBe(false);
    expect(can(trusted, "stories.publish")).toBe(false);
  });

  it("EVERY admin can publish, regardless of the legacy can_publish column", () => {
    // Owner decision, 2026-09-22: publishing follows the role. There is no
    // per-person publish override, so the stale column must not silently
    // withhold a capability an admin is supposed to have.
    expect(can(admin({ can_publish: false }), "genes.publish")).toBe(true);
    expect(can(admin({ can_publish: false }), "stories.publish")).toBe(true);
    expect(can(admin({ can_publish: true }), "genes.publish")).toBe(true);
  });

  it("capabilitiesFor() gives an admin the publish capabilities either way", () => {
    // Nav and dashboards render from this list, so a Publish control must
    // appear for any admin.
    expect(capabilitiesFor(admin({ can_publish: false }))).toContain("genes.publish");
    expect(capabilitiesFor(admin({ can_publish: true }))).toContain("genes.publish");
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
    expect(canAny(reviewer(), ["activity.view", "team.manage"])).toBe(false);
  });

  it("empty lists behave sensibly", () => {
    expect(canAll(reviewer(), [])).toBe(true);
    expect(canAny(reviewer(), [])).toBe(false);
  });
});
