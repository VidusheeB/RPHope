// Regression tests for the three systemic retrieval failures found in the
// five-gene review (ADIPOR1, FSCN2, CWC27, CFAP418, CLRN1).

import { describe, it, expect } from "vitest";
import { classifyTrialForGene } from "@/lib/geneResearch/trials";
import { dedupeLiterature, isPreprint, titleSimilarity } from "@/lib/geneResearch/rank";
import type { LiteratureRecord } from "@/lib/geneResearch/types";

describe("trial relevance comes from the intervention target, not the search that found it", () => {
  it("keeps BF844 gene-specific for CLRN1 even though it registers under Usher syndrome", () => {
    // The review's CLRN1 block: BF844 is designed around mutant CLRN1 N48K, but
    // it is only reachable via the Usher-syndrome-type-3 search. The old code
    // force-marked every disease_search hit as non-gene-specific.
    expect(classifyTrialForGene(["CLRN1"], "CLRN1")).toBe("gene_specific");
  });

  it("excludes the AXV-101 BBS1 trial from a CFAP418 page", () => {
    // The review's CFAP418 revision: a BBS1 retinal gene therapy rode the
    // Bardet-Biedl syndrome search onto the CFAP418 page.
    expect(classifyTrialForGene(["BBS1"], "CFAP418")).toBe("other_gene");
  });

  it("keeps genuinely syndrome-level studies, which name no gene at all", () => {
    expect(classifyTrialForGene([], "CFAP418")).toBe("not_gene_targeted");
  });

  it("matches the gene through an alias", () => {
    // CFAP418's older symbol is C8orf37, which is how trials often name it.
    expect(classifyTrialForGene(["C8ORF37"], "CFAP418", ["C8orf37"])).toBe("gene_specific");
  });

  it("does not treat a prefix-sharing gene as the same gene", () => {
    expect(classifyTrialForGene(["BBS10"], "BBS1")).toBe("other_gene");
    expect(classifyTrialForGene(["CFAP418L"], "CFAP418")).toBe("other_gene");
  });
});

function lit(over: Partial<LiteratureRecord>): LiteratureRecord {
  return {
    sourceId: "pubmed:1",
    source: "pubmed",
    title: "t",
    abstract: "a",
    url: "https://example.org",
    evidenceCategory: "human_phenotype_natural_history",
    score: 1,
    foundBy: [],
    ...over,
  } as LiteratureRecord;
}

describe("preprint detection", () => {
  it("recognises a medRxiv/bioRxiv DOI", () => {
    expect(isPreprint({ doi: "10.1101/2021.03.01.21252713" })).toBe(true);
  });
  it("does not flag a peer-reviewed journal DOI", () => {
    expect(isPreprint({ doi: "10.1016/j.ajhg.2021.05.008", journal: "Am J Hum Genet" })).toBe(false);
  });
});

describe("a preprint and its published version collapse into one record", () => {
  const PREPRINT = lit({
    sourceId: "europepmc:PPR123456",
    source: "europepmc",
    doi: "10.1101/2021.03.01.21252713",
    title: "Biallelic variants in INPP5E cause a spectrum of retinal ciliopathy",
    abstract: "preprint abstract",
    foundBy: ["europepmc-broad"],
  });
  const PUBLISHED = lit({
    sourceId: "pubmed:34188062",
    source: "pubmed",
    pmid: "34188062",
    doi: "10.1016/j.ajhg.2021.05.008",
    journal: "American Journal of Human Genetics",
    title: "Biallelic variants in INPP5E cause a spectrum of retinal ciliopathy",
    abstract: "published abstract",
    foundBy: ["pubmed-broad"],
  });

  it("yields one card, not two — the INPP5E failure", () => {
    expect(dedupeLiterature([{ ...PREPRINT }, { ...PUBLISHED }])).toHaveLength(1);
  });

  it("keeps the peer-reviewed version regardless of arrival order", () => {
    for (const order of [[PREPRINT, PUBLISHED], [PUBLISHED, PREPRINT]]) {
      const [kept] = dedupeLiterature(order.map((r) => ({ ...r })));
      expect(kept.pmid).toBe("34188062");
      expect(kept.doi).toBe("10.1016/j.ajhg.2021.05.008");
      expect(kept.abstract).toBe("published abstract");
    }
  });

  it("merges provenance and records which preprint it superseded", () => {
    const [kept] = dedupeLiterature([{ ...PREPRINT }, { ...PUBLISHED }]);
    expect(kept.foundBy.sort()).toEqual(["europepmc-broad", "pubmed-broad"]);
    expect(kept.supersededPreprint?.doi).toBe("10.1101/2021.03.01.21252713");
  });

  it("still collapses them when the title was reworded before publication", () => {
    const reworded = { ...PUBLISHED, title: "Biallelic INPP5E variants cause a spectrum of retinal ciliopathy" };
    expect(titleSimilarity(PREPRINT.title, reworded.title)).toBeGreaterThanOrEqual(0.85);
    expect(dedupeLiterature([{ ...PREPRINT }, { ...reworded }])).toHaveLength(1);
  });

  it("does NOT merge two genuinely different papers on the same gene", () => {
    const other = lit({
      sourceId: "pubmed:99",
      pmid: "99",
      doi: "10.1016/j.other.2022",
      journal: "Ophthalmology",
      title: "Long-term visual outcomes in INPP5E-associated Joubert syndrome",
    });
    expect(dedupeLiterature([{ ...PREPRINT }, other])).toHaveLength(2);
  });

  it("never promotes one preprint over another (only a published version wins)", () => {
    // Same-titled records are the same paper and still collapse, but with two
    // preprints there is no peer-reviewed version to promote.
    const p2 = lit({
      sourceId: "europepmc:PPR999",
      doi: "10.1101/2022.09.09.999999",
      title: "Biallelic variants in INPP5E cause a spectrum of retinal ciliopathy",
    });
    const [kept] = dedupeLiterature([{ ...PREPRINT }, p2]);
    expect(kept.supersededPreprint).toBeUndefined();
    expect(kept.sourceId).toBe("europepmc:PPR123456");
  });
});

describe("distinct papers with similar titles are NOT collapsed", () => {
  // The dedup guard is: exactly one of the pair must be a preprint, AND the
  // titles must reach a Jaccard overlap of 0.85 on significant tokens. There
  // are deliberately NO author or year guards — a preprint and its published
  // version routinely differ in year (and in author list), so a year guard
  // would break the very merge this feature exists to perform. The threshold
  // plus the exactly-one-preprint rule is what does the work.
  const THRESHOLD = 0.85;

  function preprint(title: string) {
    return lit({
      sourceId: "europepmc:PPR1",
      doi: "10.1101/2021.01.01.111111",
      title,
    });
  }
  function published(title: string, pmid = "111") {
    return lit({
      sourceId: `pubmed:${pmid}`,
      pmid,
      doi: `10.1016/j.x.${pmid}`,
      journal: "Journal",
      title,
    });
  }

  const NEAR_MISSES: [string, string, string][] = [
    [
      "a different gene, same sentence frame",
      "Biallelic variants in INPP5E cause a spectrum of retinal ciliopathy",
      "Biallelic variants in CEP290 cause a spectrum of retinal ciliopathy",
    ],
    [
      "same gene, different disease",
      "RPGR variants in X-linked retinitis pigmentosa",
      "RPGR variants in X-linked cone-rod dystrophy",
    ],
    [
      "a two-part series",
      "Gene therapy for CLRN1 Usher syndrome: part 1",
      "Gene therapy for CLRN1 Usher syndrome: part 2",
    ],
    [
      "animal vs human model",
      "CLRN1 rescue in mouse models of Usher syndrome type 3",
      "CLRN1 rescue in human retinal organoids of Usher syndrome type 3",
    ],
    [
      "different cohort sizes",
      "Natural history of RPGR retinopathy in 100 patients",
      "Natural history of RPGR retinopathy in 250 patients",
    ],
    [
      "a narrower inheritance claim",
      "A novel mutation in KIZ causes retinitis pigmentosa",
      "A novel mutation in KIZ causes autosomal recessive retinitis pigmentosa",
    ],
  ];

  it.each(NEAR_MISSES)("keeps both papers: %s", (_label, a, b) => {
    expect(titleSimilarity(a, b)).toBeLessThan(THRESHOLD);
    expect(dedupeLiterature([preprint(a), published(b)])).toHaveLength(2);
  });

  it("keeps numeric tokens, which alone can distinguish two papers", () => {
    // Regression: tokens of two characters or fewer were dropped, so
    // "part 1" and "part 2" scored a perfect 1.000 and were merged.
    expect(
      titleSimilarity(
        "Gene therapy for CLRN1 Usher syndrome: part 1",
        "Gene therapy for CLRN1 Usher syndrome: part 2"
      )
    ).toBeLessThan(THRESHOLD);
  });

  it("still merges the real case — a reworded published version", () => {
    const a = "Biallelic variants in INPP5E cause a spectrum of retinal ciliopathy";
    const b = "Biallelic INPP5E variants cause a spectrum of retinal ciliopathy";
    expect(titleSimilarity(a, b)).toBeGreaterThanOrEqual(THRESHOLD);
    expect(dedupeLiterature([preprint(a), published(b)])).toHaveLength(1);
  });

  it("never merges two papers when NEITHER is a preprint", () => {
    // Two published papers with identical titles still collapse on the exact
    // title key (they are the same paper), but the version-promotion path
    // must not fire — there is no preprint to supersede.
    const [kept] = dedupeLiterature([published("Same title here", "1"), published("Same title here", "2")]);
    expect(kept.supersededPreprint).toBeUndefined();
  });
});
