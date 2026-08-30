// The 94-gene catalog and the retrieval behaviour it drives.
// Source: RP_Hope_genes_to_include_94.xlsx (compiled 22 August 2026).

import { describe, it, expect } from "vitest";
import { geneCatalog, getCatalogGene, getCatalogSearchTerms } from "@/lib/geneCatalog";
import { geneGrid } from "@/lib/geneGrid";
import { GENE_REDIRECTS } from "@/lib/geneRedirects.mjs";
import { buildTrialCondition } from "@/lib/geneResearch/trials";
import { assessRelevance } from "@/lib/geneResearch/relevance";
import { buildEvidenceTierBlock } from "@/lib/geneResearch/prompts";
import { normalizeGene, normalizeCondition } from "@/lib/trials/normalize";
import { CONDITIONS } from "@/lib/trials/intakeOptions";
import genesData from "@/lib/genesData.json";
import geneArticles from "@/lib/geneArticles.json";

describe("gene catalog", () => {
  it("holds the sheet's 94 genes plus BEST2 and ENSA", () => {
    expect(geneCatalog).toHaveLength(96);
    expect(getCatalogGene("best2")?.evidenceTier).toBe("disputed");
    expect(getCatalogGene("ensa")?.evidenceTier).toBe("disputed");
  });

  it("has a unique slug per gene", () => {
    const slugs = geneCatalog.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("carries the renamed, merged and added genes", () => {
    const slugs = new Set(geneCatalog.map((g) => g.slug));
    for (const s of ["cfap418", "ofd1", "ttc8"]) expect(slugs.has(s)).toBe(true);
    // Retired: renamed, duplicated, or a locus name rather than a gene.
    for (const s of ["c8orf37", "bbs3", "ush3a", "lca", "rp17", "rp51"]) {
      expect(slugs.has(s)).toBe(false);
    }
  });

  it("keeps C8orf37 searchable after the CFAP418 rename", () => {
    // Dropping the old symbol from the query would lose a decade of papers.
    expect(getCatalogSearchTerms("cfap418")).toContain("C8orf37");
  });

  it("stays in lockstep with the display grid", () => {
    expect(geneGrid.map((g) => g.slug).sort()).toEqual(
      geneCatalog.map((g) => g.slug).sort()
    );
  });
});

describe("gene redirects", () => {
  it("forwards every retired slug, and none that is still live", () => {
    const live = new Set(geneCatalog.map((g) => g.slug));
    for (const [from, to] of Object.entries(GENE_REDIRECTS)) {
      expect(live.has(from)).toBe(false);
      // A locus name has no gene to forward to; it returns to the library.
      if (to !== null) expect(live.has(to)).toBe(true);
    }
  });
});

describe("trial condition", () => {
  it("searches the gene's syndrome as well as RP", () => {
    // CLRN1's studies are registered as Usher syndrome type 3, never as RP.
    const cond = buildTrialCondition(getCatalogGene("clrn1")!.diseaseTerms);
    expect(cond).toContain('"retinitis pigmentosa"');
    expect(cond).toContain('"Usher syndrome type 3"');
    expect(cond).toContain(" OR ");
  });

  it("quotes phrases so multi-word names do not match as loose words", () => {
    expect(buildTrialCondition(["Stargardt disease"])).toBe(
      '"retinitis pigmentosa" OR "Stargardt disease"'
    );
  });

  it("falls back to RP alone for a gene with no disease terms", () => {
    expect(buildTrialCondition([])).toBe('"retinitis pigmentosa"');
  });
});

describe("relevance gate with per-gene disease context", () => {
  const bbsPaper = {
    title: "Obesity and polydactyly in Bardet-Biedl syndrome",
    abstract: "A cohort study of metabolic outcomes and digit anomalies.",
  };

  it("drops a syndrome paper that names no retinal term, without gene context", () => {
    expect(assessRelevance(bbsPaper).relevant).toBe(false);
  });

  it("keeps it for a gene whose own syndrome it is", () => {
    expect(assessRelevance(bbsPaper, ["Bardet-Biedl syndrome"]).relevant).toBe(true);
  });

  it("does not widen the gate for an unrelated gene", () => {
    expect(assessRelevance(bbsPaper, ["Stargardt disease"]).relevant).toBe(false);
  });
});

describe("evidence tier block", () => {
  it("is empty for a gene outside the catalog", () => {
    expect(buildEvidenceTierBlock(null)).toBe("");
  });

  it("tells a disputed gene to say the association is not supported", () => {
    const block = buildEvidenceTierBlock({
      tier: "disputed",
      framingNote: "GeneReviews calls it an unlikely cause.",
    });
    expect(block).toContain("DISPUTED");
    expect(block).toContain("GeneReviews calls it an unlikely cause.");
  });

  it("lets an established gene state the association plainly", () => {
    expect(buildEvidenceTierBlock({ tier: "established", framingNote: "" })).toContain(
      "established"
    );
  });
});

describe("retired gene symbols still resolve", () => {
  // A lab report or an older paper may name a symbol the library no longer
  // lists. Falling through to "no match" reads to a visitor as "your gene
  // isn't here", which is wrong — it is here, under its current name.
  it("resolves an HGNC-renamed symbol to the current gene", () => {
    const r = normalizeGene("C8orf37");
    expect(r.status).toBe("corrected");
    expect(r.normalized).toBe("CFAP418");
    expect(r.confidence).toBe("high");
  });

  it("resolves a merged duplicate's old symbol", () => {
    expect(normalizeGene("USH3A").normalized).toBe("CLRN1");
    expect(normalizeGene("BBS3").normalized).toBe("ARL6");
  });

  it("does not let an alias shadow a real gene of its own", () => {
    // USH2A is a gene in its own right, not an alias for anything.
    const r = normalizeGene("USH2A");
    expect(r.status).toBe("exact");
    expect(r.normalized).toBe("USH2A");
  });

  it("still reports a genuine non-gene as unmatched", () => {
    expect(normalizeGene("zzzznotagene").status).toBe("none");
  });
});

describe("gene data has no retired entries", () => {
  it("keeps genesData and the article index inside the current library", () => {
    const slugs = new Set(geneCatalog.map((g) => g.slug));
    for (const g of genesData as { slug: string }[]) {
      expect(slugs.has(g.slug), `genesData has retired gene "${g.slug}"`).toBe(true);
    }
    for (const key of Object.keys(geneArticles)) {
      expect(slugs.has(key), `geneArticles has retired gene "${key}"`).toBe(true);
    }
  });

  it("carried C8orf37's real content over to CFAP418", () => {
    const cfap = (genesData as { slug: string; summary?: string }[]).find(
      (g) => g.slug === "cfap418"
    );
    expect(cfap?.summary).toBeTruthy();
    // The page must say why older research uses a different symbol.
    expect(cfap?.summary).toContain("C8orf37");
  });

  it("did NOT turn the old LCA disease page into the LCA5 gene page", () => {
    // "LCA" was Leber congenital amaurosis, a disease caused by ~25 genes.
    // LCA5 is one of them. Reusing that text here would be medically wrong.
    const lca5 = (genesData as { slug: string }[]).find((g) => g.slug === "lca5");
    expect(lca5).toBeUndefined();
  });
});

describe("library membership comes from the catalog, not the database", () => {
  // A database that has drifted from the reviewed sheet must not be able to
  // shrink the library. Production was serving 66 genes — including retired
  // duplicates and an `abgl5` typo — while the reconciled list held 94, and
  // nothing surfaced the discrepancy because an unlisted gene is invisible.
  it("exposes every catalog gene regardless of what the DB returns", async () => {
    const { getGeneGrid } = await import("@/lib/genesRepo");
    const { items } = await getGeneGrid();
    expect(items).toHaveLength(geneCatalog.length);
    expect(items.map((i) => i.slug).sort()).toEqual(geneCatalog.map((g) => g.slug).sort());
  });
});

describe("clinical trials intake — condition options", () => {
  it("no longer offers Stargardt or LCA as headline choices", () => {
    const values = CONDITIONS.map((c) => c.value);
    expect(values).not.toContain("stargardt disease");
    expect(values).not.toContain("leber congenital amaurosis");
  });

  it("still routes someone who types them, rather than dead-ending", () => {
    // Removing the options must not remove the capability: both reach the
    // free-text box behind "Other inherited retinal disease" / "Not sure".
    expect(normalizeCondition("Stargardt").ctgovCondition).toBe("stargardt disease");
    expect(normalizeCondition("LCA").ctgovCondition).toBe("leber congenital amaurosis");
    expect(normalizeCondition("leber congenital amaurosis").confidence).not.toBe("low");
  });

  it("no longer offers cone-rod dystrophy or a generic retinal-disease option", () => {
    const values = CONDITIONS.map((c) => c.value);
    expect(values).not.toContain("cone-rod dystrophy");
    expect(values).not.toContain("inherited retinal disease");
  });

  it("keeps a free-text path available via 'Not sure'", () => {
    // With the list narrowed to RP and Usher, "Not sure" is the only remaining
    // way in to the free-text box — so it must stay.
    expect(CONDITIONS.map((c) => c.value)).toContain("__not_sure__");
  });

  it("still normalizes a removed condition typed as free text", () => {
    expect(normalizeCondition("cone-rod dystrophy").ctgovCondition).toBe("cone-rod dystrophy");
  });
});
