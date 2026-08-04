import { describe, it, expect } from "vitest";
import {
  allFlagsResolved,
  unresolvedFlagCount,
  requiredSectionsComplete,
  evaluateSubmissionReadiness,
  evaluateAdminPublishReadiness,
  nextVersionNumber,
  type FlagResolutionStatus,
} from "@/lib/reviewer/publishGate";
import type { GenePageDraft, SentencedText } from "@/lib/geneResearch/types";

function sourced(text = "Some real content.", sourceIds = ["pubmed:1"]): SentencedText {
  return { sentences: [{ text, sourceIds }] };
}

function completeDraft(overrides: Partial<GenePageDraft> = {}): GenePageDraft {
  return {
    gene: "LCA5",
    summaryCard: sourced(),
    whatThisGeneMeans: sourced(),
    howItMayAffectVision: sourced(),
    whatIsKnown: sourced(),
    whatIsUncertain: sourced(),
    whatYouCanDoNext: sourced("Next steps.", ["rphope-resource:x"]),
    questionsForClinician: ["q1"],
    forFamilyAndCaregivers: sourced("Caregiver guidance.", ["rphope-resource:x"]),
    treatmentAndResearch: sourced(),
    clinicalTrialSummary: sourced(),
    researchCards: [],
    sources: [
      { id: "pubmed:1", type: "pubmed", title: "x", url: "https://pubmed.ncbi.nlm.nih.gov/1/" },
      { id: "rphope-resource:x", type: "rphope-resource", title: "x", url: "/x" },
    ],
    reviewFlags: [],
    reviewStatus: "unreviewed",
    generatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const resolvedAll = (n: number): { flagIndex: number; status: FlagResolutionStatus }[] =>
  Array.from({ length: n }, (_, i) => ({ flagIndex: i, status: "wording_confirmed" as const }));

describe("flag resolution", () => {
  it("allFlagsResolved is false while any flag is unresolved/missing", () => {
    expect(allFlagsResolved(2, [{ flagIndex: 0, status: "wording_confirmed" }])).toBe(false);
    expect(allFlagsResolved(2, resolvedAll(2))).toBe(true);
  });

  it("a status of 'unresolved' counts as unresolved", () => {
    expect(allFlagsResolved(1, [{ flagIndex: 0, status: "unresolved" }])).toBe(false);
    expect(unresolvedFlagCount(3, resolvedAll(1))).toBe(2);
  });
});

describe("requiredSectionsComplete", () => {
  it("true for a fully populated draft", () => {
    expect(requiredSectionsComplete(completeDraft())).toBe(true);
  });
  it("false when a required section is empty", () => {
    expect(requiredSectionsComplete(completeDraft({ whatIsKnown: sourced("") }))).toBe(false);
  });
  it("false with no clinician questions", () => {
    expect(requiredSectionsComplete(completeDraft({ questionsForClinician: [] }))).toBe(false);
  });
});

describe("evaluateSubmissionReadiness — reviewer-facing \"Submit review\" gate", () => {
  const base = {
    draft: completeDraft(),
    flagCount: 2,
    resolutions: resolvedAll(2),
    isAssignedReviewer: true,
    confirmationChecked: true,
  };

  it("allows submission when EVERY condition is met", () => {
    expect(evaluateSubmissionReadiness(base).canProceed).toBe(true);
  });

  it("unresolved flags block submission", () => {
    const r = evaluateSubmissionReadiness({ ...base, resolutions: resolvedAll(1) });
    expect(r.canProceed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/unresolved/i);
  });

  it("a non-assigned reviewer is blocked", () => {
    const r = evaluateSubmissionReadiness({ ...base, isAssignedReviewer: false });
    expect(r.canProceed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/assigned/i);
  });

  it("an unchecked confirmation blocks submission", () => {
    expect(evaluateSubmissionReadiness({ ...base, confirmationChecked: false }).canProceed).toBe(false);
  });

  it("a missing cited source blocks submission (all source IDs must be valid)", () => {
    const draft = completeDraft({ whatIsKnown: sourced("x", ["pubmed:MISSING"]) });
    const r = evaluateSubmissionReadiness({ ...base, draft });
    expect(r.canProceed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/source/i);
  });

  it("an incomplete section blocks submission", () => {
    const draft = completeDraft({ treatmentAndResearch: sourced("") });
    expect(evaluateSubmissionReadiness({ ...base, draft }).canProceed).toBe(false);
  });

  it("does NOT check publishing permission — reviewers never see that gate", () => {
    // No reviewerCanPublish field exists on this input at all; this test
    // just documents that submission readiness is independent of it.
    expect(evaluateSubmissionReadiness(base).blockers.join(" ")).not.toMatch(/publishing permission/i);
  });
});

describe("evaluateAdminPublishReadiness — admin-only \"Approve & Publish\" gate", () => {
  const base = {
    draft: completeDraft(),
    flagCount: 2,
    resolutions: resolvedAll(2),
    isAdmin: true,
    adminCanPublish: true,
    reviewStatus: "approved" as const,
    confirmationChecked: true,
  };

  it("allows publishing when EVERY condition is met", () => {
    expect(evaluateAdminPublishReadiness(base).canProceed).toBe(true);
  });

  it("a non-admin is always blocked, regardless of anything else", () => {
    const r = evaluateAdminPublishReadiness({ ...base, isAdmin: false });
    expect(r.canProceed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/admin/i);
  });

  it("adminCanPublish=false blocks publication", () => {
    const r = evaluateAdminPublishReadiness({ ...base, adminCanPublish: false });
    expect(r.canProceed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/publishing permission/i);
  });

  it("a draft that was never approved blocks publication unless overridden", () => {
    const r = evaluateAdminPublishReadiness({ ...base, reviewStatus: "unreviewed" });
    expect(r.canProceed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/approved/i);
  });

  it("adminOverride bypasses the approved-status requirement", () => {
    const r = evaluateAdminPublishReadiness({ ...base, reviewStatus: "unreviewed", adminOverride: true });
    expect(r.canProceed).toBe(true);
  });

  it("unresolved flags still block admin publication", () => {
    const r = evaluateAdminPublishReadiness({ ...base, resolutions: resolvedAll(1) });
    expect(r.canProceed).toBe(false);
  });

  it("an unchecked confirmation blocks publication", () => {
    expect(evaluateAdminPublishReadiness({ ...base, confirmationChecked: false }).canProceed).toBe(false);
  });

  it("a missing cited source blocks publication", () => {
    const draft = completeDraft({ whatIsKnown: sourced("x", ["pubmed:MISSING"]) });
    const r = evaluateAdminPublishReadiness({ ...base, draft });
    expect(r.canProceed).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/source/i);
  });
});

describe("nextVersionNumber", () => {
  it("starts at 1 and increments past the max", () => {
    expect(nextVersionNumber([])).toBe(1);
    expect(nextVersionNumber([{ version_number: 1 }, { version_number: 3 }])).toBe(4);
  });
});
