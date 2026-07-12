import { describe, it, expect } from "vitest";
import {
  allFlagsResolved,
  unresolvedFlagCount,
  requiredSectionsComplete,
  evaluatePublishReadiness,
  nextVersionNumber,
  type FlagResolutionStatus,
} from "@/lib/reviewer/publishGate";
import type { GenePageDraft } from "@/lib/geneResearch/types";

function sourced(text = "Some real content.", sourceIds = ["pubmed:1"]) {
  return { text, sourceIds };
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

describe("evaluatePublishReadiness — the publish gate", () => {
  const base = {
    draft: completeDraft(),
    flagCount: 2,
    resolutions: resolvedAll(2),
    isAssignedReviewer: true,
    reviewerCanPublish: true,
    confirmationChecked: true,
  };

  it("allows publishing when EVERY condition is met", () => {
    expect(evaluatePublishReadiness(base).canPublish).toBe(true);
  });

  it("unresolved flags block publication", () => {
    const r = evaluatePublishReadiness({ ...base, resolutions: resolvedAll(1) });
    expect(r.canPublish).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/unresolved/i);
  });

  it("can_publish=false blocks publication", () => {
    const r = evaluatePublishReadiness({ ...base, reviewerCanPublish: false });
    expect(r.canPublish).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/publishing permission/i);
  });

  it("a non-assigned reviewer is blocked", () => {
    const r = evaluatePublishReadiness({ ...base, isAssignedReviewer: false });
    expect(r.canPublish).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/assigned/i);
  });

  it("an unchecked confirmation blocks publication", () => {
    expect(evaluatePublishReadiness({ ...base, confirmationChecked: false }).canPublish).toBe(false);
  });

  it("a missing cited source blocks publication (all source IDs must be valid)", () => {
    const draft = completeDraft({ whatIsKnown: sourced("x", ["pubmed:MISSING"]) });
    const r = evaluatePublishReadiness({ ...base, draft });
    expect(r.canPublish).toBe(false);
    expect(r.blockers.join(" ")).toMatch(/source/i);
  });

  it("an incomplete section blocks publication", () => {
    const draft = completeDraft({ treatmentAndResearch: sourced("") });
    expect(evaluatePublishReadiness({ ...base, draft }).canPublish).toBe(false);
  });
});

describe("nextVersionNumber", () => {
  it("starts at 1 and increments past the max", () => {
    expect(nextVersionNumber([])).toBe(1);
    expect(nextVersionNumber([{ version_number: 1 }, { version_number: 3 }])).toBe(4);
  });
});
