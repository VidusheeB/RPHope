import { describe, it, expect } from "vitest";
import { scorePubMedRecord, rankAndDedupPubMed } from "@/lib/geneResearch/rank";
import type { PubMedRecord } from "@/lib/geneResearch/types";

function rec(overrides: Partial<PubMedRecord>): PubMedRecord {
  return {
    sourceId: "pubmed:1",
    pmid: "1",
    title: "",
    abstract: "",
    url: "https://pubmed.ncbi.nlm.nih.gov/1/",
    score: 0,
    ...overrides,
  };
}

describe("scorePubMedRecord", () => {
  it("scores higher when the gene symbol appears", () => {
    const withGene = scorePubMedRecord(
      { title: "RPGR mutations in RP", abstract: "", year: 2020 },
      "RPGR"
    );
    const withoutGene = scorePubMedRecord(
      { title: "Unrelated topic", abstract: "", year: 2020 },
      "RPGR"
    );
    expect(withGene).toBeGreaterThan(withoutGene);
  });

  it("scores higher for retinal-disease vocabulary", () => {
    const relevant = scorePubMedRecord(
      { title: "Gene X", abstract: "retinitis pigmentosa photoreceptor loss", year: 2020 },
      "GENEX"
    );
    const irrelevant = scorePubMedRecord(
      { title: "Gene X", abstract: "unrelated cardiac finding", year: 2020 },
      "GENEX"
    );
    expect(relevant).toBeGreaterThan(irrelevant);
  });

  it("scores recent papers higher than old ones", () => {
    const recent = scorePubMedRecord({ title: "", abstract: "", year: new Date().getFullYear() }, "X");
    const old = scorePubMedRecord({ title: "", abstract: "", year: 1990 }, "X");
    expect(recent).toBeGreaterThan(old);
  });

  it("does not error when year is missing", () => {
    expect(() => scorePubMedRecord({ title: "", abstract: "" }, "X")).not.toThrow();
  });
});

describe("rankAndDedupPubMed", () => {
  it("deduplicates by pmid, keeping the first occurrence", () => {
    const input = [
      rec({ pmid: "1", score: 5, title: "first" }),
      rec({ pmid: "1", score: 9, title: "duplicate" }),
      rec({ pmid: "2", score: 3, title: "second" }),
    ];
    const out = rankAndDedupPubMed(input, 10);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.pmid === "1")?.title).toBe("first");
  });

  it("sorts by score descending", () => {
    const input = [
      rec({ pmid: "1", score: 2 }),
      rec({ pmid: "2", score: 9 }),
      rec({ pmid: "3", score: 5 }),
    ];
    const out = rankAndDedupPubMed(input, 10);
    expect(out.map((r) => r.pmid)).toEqual(["2", "3", "1"]);
  });

  it("breaks score ties by more recent year", () => {
    const input = [
      rec({ pmid: "1", score: 5, year: 2015 }),
      rec({ pmid: "2", score: 5, year: 2023 }),
    ];
    const out = rankAndDedupPubMed(input, 10);
    expect(out[0].pmid).toBe("2");
  });

  it("respects the limit", () => {
    const input = Array.from({ length: 30 }, (_, i) => rec({ pmid: String(i), score: i }));
    expect(rankAndDedupPubMed(input, 20)).toHaveLength(20);
  });
});
