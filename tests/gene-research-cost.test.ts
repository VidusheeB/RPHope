import { describe, it, expect } from "vitest";
import { estimateCostUsd, estimateCostBeforeGeneration } from "@/lib/geneResearch/generate";
import type { GeneSourceBundle } from "@/lib/geneResearch/types";

function bundle(literatureCount: number): GeneSourceBundle {
  return {
    geneSymbol: "RPGR",
    geneSlug: "rpgr",
    evidence: null,
    geneRecord: { sourceId: "ncbi-gene:6103", geneId: "6103", symbol: "RPGR", aliases: [] },
    literatureRecords: Array.from({ length: literatureCount }, (_, i) => ({
      sourceId: `pubmed:${i}`,
      source: "pubmed" as const,
      pmid: String(i),
      title: "A reasonably long title about RPGR and retinitis pigmentosa research",
      abstract: "A long abstract ".repeat(50),
      url: "https://pubmed.ncbi.nlm.nih.gov/1/",
      evidenceCategory: "human_phenotype_natural_history" as const,
      score: 10,
      foundBy: ["pubmed-broad" as const],
    })),
    trialRecords: [],
    approvedResources: [],
    webFallbackRecords: [],
    unverifiedTrialReferences: [],
  };
}

describe("estimateCostUsd", () => {
  it("matches the documented $5/M input, $25/M output pricing", () => {
    expect(estimateCostUsd(1_000_000, 0)).toBeCloseTo(5, 5);
    expect(estimateCostUsd(0, 1_000_000)).toBeCloseTo(25, 5);
  });
});

describe("estimateCostBeforeGeneration", () => {
  it("produces a positive estimate even for an empty-ish bundle", () => {
    const est = estimateCostBeforeGeneration(bundle(0));
    expect(est.estimatedInputTokens).toBeGreaterThan(0);
    expect(est.estimatedOutputTokens).toBeGreaterThan(0);
    expect(est.estimatedCostUsd).toBeGreaterThan(0);
  });

  it("grows the input estimate as the evidence bundle grows", () => {
    const small = estimateCostBeforeGeneration(bundle(2));
    const large = estimateCostBeforeGeneration(bundle(20));
    expect(large.estimatedInputTokens).toBeGreaterThan(small.estimatedInputTokens);
    expect(large.estimatedCostUsd).toBeGreaterThan(small.estimatedCostUsd);
  });

  it("is in a realistic ballpark for a typical gene (a few cents to tens of cents)", () => {
    const est = estimateCostBeforeGeneration(bundle(15));
    expect(est.estimatedCostUsd).toBeGreaterThan(0.02);
    expect(est.estimatedCostUsd).toBeLessThan(1);
  });
});
