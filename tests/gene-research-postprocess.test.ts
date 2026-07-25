import { describe, it, expect } from "vitest";
import { enforceLimits } from "@/lib/geneResearch/postprocess";
import type { GenePageDraft, SentencedText } from "@/lib/geneResearch/types";

function baseDraft(overrides: Partial<GenePageDraft> = {}): GenePageDraft {
  const sourced: SentencedText = { sentences: [{ text: "x", sourceIds: [] }] };
  return {
    gene: "TESTGENE",
    summaryCard: sourced,
    whatThisGeneMeans: sourced,
    howItMayAffectVision: sourced,
    whatIsKnown: sourced,
    whatIsUncertain: sourced,
    whatYouCanDoNext: sourced,
    questionsForClinician: [],
    forFamilyAndCaregivers: sourced,
    treatmentAndResearch: sourced,
    clinicalTrialSummary: sourced,
    researchCards: [],
    sources: [],
    reviewFlags: [],
    reviewStatus: "unreviewed",
    generatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const card = (n: number) => ({
  title: `Card ${n}`,
  whatWasStudied: "x",
  whatWasFound: "x",
  whyItMatters: "x",
  evidenceType: "x",
  limitation: "x",
  sourceIds: [],
});

describe("enforceLimits", () => {
  it("leaves a compliant draft untouched", () => {
    const draft = baseDraft({
      researchCards: [card(1), card(2)],
      questionsForClinician: ["q1", "q2"],
    });
    const out = enforceLimits(draft);
    expect(out.researchCards).toHaveLength(2);
    expect(out.questionsForClinician).toHaveLength(2);
    expect(out.reviewFlags).toEqual([]);
  });

  it("truncates researchCards over 5 and flags it", () => {
    const draft = baseDraft({
      researchCards: [card(1), card(2), card(3), card(4), card(5), card(6), card(7)],
    });
    const out = enforceLimits(draft);
    expect(out.researchCards).toHaveLength(5);
    expect(out.researchCards[0].title).toBe("Card 1");
    expect(out.reviewFlags.some((f) => f.includes("research cards"))).toBe(true);
  });

  it("truncates questionsForClinician over 6 and flags it", () => {
    const draft = baseDraft({
      questionsForClinician: ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"],
    });
    const out = enforceLimits(draft);
    expect(out.questionsForClinician).toHaveLength(6);
    expect(out.reviewFlags.some((f) => f.includes("clinician questions"))).toBe(true);
  });

  it("preserves existing reviewFlags alongside any new ones", () => {
    const draft = baseDraft({
      reviewFlags: ["existing concern"],
      researchCards: [card(1), card(2), card(3), card(4), card(5), card(6)],
    });
    const out = enforceLimits(draft);
    expect(out.reviewFlags).toContain("existing concern");
    expect(out.reviewFlags.length).toBe(2);
  });
});
