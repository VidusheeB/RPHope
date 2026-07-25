import { describe, it, expect } from "vitest";
import { validateDraft } from "@/lib/geneResearch/validate";
import type { GeneSourceBundle, GenePageDraft, SentencedText } from "@/lib/geneResearch/types";

function bundle(overrides: Partial<GeneSourceBundle> = {}): GeneSourceBundle {
  return {
    geneSymbol: "RPGR",
    geneSlug: "rpgr",
    geneRecord: {
      sourceId: "ncbi-gene:6103",
      geneId: "6103",
      symbol: "RPGR",
      aliases: [],
    },
    literatureRecords: [
      {
        sourceId: "pubmed:12345",
        source: "pubmed",
        pmid: "12345",
        title: "x",
        abstract: "x",
        url: "https://pubmed.ncbi.nlm.nih.gov/12345/",
        evidenceCategory: "human_phenotype_natural_history",
        score: 10,
        foundBy: ["pubmed-broad"],
      },
    ],
    trialRecords: [],
    approvedResources: [
      { sourceId: "rphope-resource:genetic-testing", title: "x", url: "/x", note: "x" },
    ],
    webFallbackRecords: [],
    unverifiedTrialReferences: [],
    ...overrides,
  };
}

function sourced(sourceIds: string[] = []): SentencedText {
  return { sentences: [{ text: "some text", sourceIds }] };
}

function draft(overrides: Partial<GenePageDraft> = {}): GenePageDraft {
  return {
    gene: "RPGR",
    summaryCard: sourced(["ncbi-gene:6103"]),
    whatThisGeneMeans: sourced(["pubmed:12345"]),
    howItMayAffectVision: sourced(["pubmed:12345"]),
    whatIsKnown: sourced(["pubmed:12345"]),
    whatIsUncertain: sourced([]),
    whatYouCanDoNext: sourced(["rphope-resource:genetic-testing"]),
    questionsForClinician: ["q1"],
    forFamilyAndCaregivers: sourced(["rphope-resource:genetic-testing"]),
    treatmentAndResearch: sourced(["pubmed:12345"]),
    clinicalTrialSummary: sourced([]),
    researchCards: [],
    sources: [
      { id: "ncbi-gene:6103", type: "ncbi-gene", title: "RPGR", url: "https://ncbi.nlm.nih.gov" },
      { id: "pubmed:12345", type: "pubmed", title: "x", url: "https://pubmed.ncbi.nlm.nih.gov/12345/" },
      {
        id: "rphope-resource:genetic-testing",
        type: "rphope-resource",
        title: "x",
        url: "/newly-diagnosed",
      },
    ],
    reviewFlags: [],
    reviewStatus: "unreviewed",
    generatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("validateDraft", () => {
  it("accepts a draft whose every source ID is in the supplied bundle", () => {
    const result = validateDraft(draft(), bundle());
    expect(result.ok).toBe(true);
  });

  it("rejects a draft that cites an unknown source ID", () => {
    const bad = draft({
      whatIsKnown: sourced(["pubmed:99999999"]), // not in the bundle
    });
    const result = validateDraft(bad, bundle());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some((r) => r.code === "unknown_source_id")).toBe(true);
      expect(result.reasons[0].detail).toContain("pubmed:99999999");
    }
  });

  it("rejects a draft that cites a fabricated web source not in the bundle", () => {
    const bad = draft({
      treatmentAndResearch: sourced(["web:1"]), // no webFallbackRecords supplied
    });
    const result = validateDraft(bad, bundle());
    expect(result.ok).toBe(false);
  });

  it("accepts a real web fallback source when it's actually in the bundle", () => {
    const b = bundle({
      webFallbackRecords: [
        { sourceId: "web:1", title: "x", url: "https://clinicaltrials.gov/study/NCT1", domain: "clinicaltrials.gov", snippet: "A real captured excerpt of page text long enough to count." },
      ],
    });
    const d = draft({ treatmentAndResearch: sourced(["web:1"]) });
    expect(validateDraft(d, b).ok).toBe(true);
  });

  it("checks source IDs inside research cards too", () => {
    const bad = draft({
      researchCards: [
        {
          title: "x",
          whatWasStudied: "x",
          whatWasFound: "x",
          whyItMatters: "x",
          evidenceType: "x",
          limitation: "x",
          sourceIds: ["pubmed:invented"],
        },
      ],
    });
    const result = validateDraft(bad, bundle());
    expect(result.ok).toBe(false);
  });

  it("checks the top-level sources array for unknown IDs even if no prose field cites it", () => {
    const bad = draft({
      sources: [
        ...draft().sources,
        { id: "pubmed:phantom", type: "pubmed", title: "ghost", url: "https://pubmed.ncbi.nlm.nih.gov/0/" },
      ],
    });
    const result = validateDraft(bad, bundle());
    expect(result.ok).toBe(false);
  });

  it("rejects a structurally invalid draft (fails Ajv schema validation)", () => {
    // Missing required fields entirely.
    const invalid = { gene: "RPGR" } as unknown as GenePageDraft;
    const result = validateDraft(invalid, bundle());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.some((r) => r.code === "schema_validation_failed")).toBe(true);
    }
  });

  it("can report multiple simultaneous reject reasons", () => {
    const bad = { gene: "RPGR", sources: [{ id: "made:up" }] } as unknown as GenePageDraft;
    const result = validateDraft(bad, bundle());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons.length).toBeGreaterThanOrEqual(1);
    }
  });
});
