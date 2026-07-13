import { describe, it, expect } from "vitest";
import { resolvePreselectedGene } from "@/lib/trials/genePreselect";
import { geneGrid } from "@/lib/geneGrid";

// The gene-page "Find clinical trials" CTA links to /clinical-trials?gene=<slug>.
// resolvePreselectedGene validates that parameter against the supported gene list
// and is the single source of truth for whether a gene is preselected. These
// tests cover the behaviors the Finder relies on.

describe("resolvePreselectedGene — gene-page CTA parameter", () => {
  it("preselects a valid gene (exact match) → canonical display name", () => {
    expect(resolvePreselectedGene("RPGR")).toBe("RPGR");
    expect(resolvePreselectedGene("USH2A")).toBe("USH2A");
  });

  it("normalizes case and punctuation to the canonical display name", () => {
    expect(resolvePreselectedGene("lca5")).toBe("LCA5");
    expect(resolvePreselectedGene("Lca5")).toBe("LCA5");
    expect(resolvePreselectedGene("  rpgr  ")).toBe("RPGR");
    // greek-word + spacing normalization handled by the shared normalizer
    expect(resolvePreselectedGene("pde6 beta")).toBe("PDE6B");
  });

  it("falls back to null for an unknown gene (no throw, no broken state)", () => {
    expect(resolvePreselectedGene("NOTAGENE")).toBeNull();
    expect(resolvePreselectedGene("zzz9")).toBeNull();
    // a fuzzy near-miss must NOT silently preselect a 'did you mean' gene
    expect(resolvePreselectedGene("rpgrr")).toBeNull();
  });

  it("treats a cleared/absent selection as no preselection", () => {
    expect(resolvePreselectedGene("")).toBeNull();
    expect(resolvePreselectedGene("   ")).toBeNull();
    expect(resolvePreselectedGene(null)).toBeNull();
    expect(resolvePreselectedGene(undefined)).toBeNull();
  });

  it("resolves direct navigation to /clinical-trials?gene=lca5", () => {
    // Simulate the server reading searchParams.gene for a deep link.
    const searchParams: { gene?: string | string[] } = { gene: "lca5" };
    const raw = Array.isArray(searchParams.gene) ? searchParams.gene[0] : searchParams.gene;
    expect(resolvePreselectedGene(raw)).toBe("LCA5");
  });

  it("resolves every gene in the library (every CTA links reliably)", () => {
    const unresolved = geneGrid.filter(
      (g) => resolvePreselectedGene(g.slug) !== g.display.toUpperCase(),
    );
    expect(unresolved).toEqual([]);
  });
});
