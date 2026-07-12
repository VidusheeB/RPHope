import { describe, it, expect } from "vitest";
import {
  scoreLiteratureRecord,
  dedupeLiterature,
  selectCategoryBalancedEvidence,
  classifyEvidence,
  scoreTrialRecord,
  rankAndCapTrials,
} from "@/lib/geneResearch/rank";
import type {
  EvidenceCategory,
  FoundBy,
  LiteratureRecord,
  TrialSummaryRecord,
} from "@/lib/geneResearch/types";

function trial(overrides: Partial<TrialSummaryRecord>): TrialSummaryRecord {
  return {
    sourceId: "clinicaltrials:NCT1",
    nctId: "NCT1",
    title: "x",
    status: "RECRUITING",
    geneSpecific: false,
    url: "https://clinicaltrials.gov/study/NCT1",
    ...overrides,
  };
}

function rec(overrides: Partial<LiteratureRecord>): LiteratureRecord {
  return {
    sourceId: "pubmed:1",
    source: "pubmed",
    pmid: "1",
    title: "",
    abstract: "",
    url: "https://pubmed.ncbi.nlm.nih.gov/1/",
    evidenceCategory: "other",
    score: 0,
    foundBy: ["pubmed-broad"],
    ...overrides,
  };
}

describe("classifyEvidence (5-bucket taxonomy)", () => {
  it("detects reviews (a genuine literature/synthesis review, not a chart review)", () => {
    expect(classifyEvidence("A systematic review of gene therapy", "")).toBe("review");
    expect(classifyEvidence("Meta-analysis of RPGR outcomes", "")).toBe("review");
    // "retrospective review of records" is a cohort study, NOT a lit review.
    expect(
      classifyEvidence("Retrospective review of records", "60 patients in a diagnostic cohort")
    ).toBe("human_phenotype_natural_history");
  });

  it("detects human interventional treatment studies (the study actually treated)", () => {
    expect(classifyEvidence("Subretinal injection of an AAV vector in patients", "")).toBe(
      "treatment_clinical"
    );
    expect(classifyEvidence("A phase 1 clinical trial", "")).toBe("treatment_clinical");
    expect(
      classifyEvidence("Outcomes", "Patients were treated and adverse events were recorded")
    ).toBe("treatment_clinical");
  });

  it("does NOT treat a bare 'gene therapy' mention as treatment evidence", () => {
    // No indication treatment was actually studied → not treatment_clinical.
    expect(classifyEvidence("Gene therapy for retinal degeneration", "")).toBe("other");
  });

  it("detects preclinical/mechanism work (animal + laboratory)", () => {
    expect(classifyEvidence("Gene X in a mouse model", "")).toBe("preclinical_mechanism");
    expect(classifyEvidence("Zebrafish retinal phenotype", "")).toBe("preclinical_mechanism");
    expect(classifyEvidence("", "We used an induced pluripotent stem cell line")).toBe(
      "preclinical_mechanism"
    );
  });

  it("detects human phenotype / natural-history evidence", () => {
    expect(classifyEvidence("A natural history study of RPGR", "")).toBe(
      "human_phenotype_natural_history"
    );
    expect(classifyEvidence("Genotype-phenotype correlations", "")).toBe(
      "human_phenotype_natural_history"
    );
    expect(classifyEvidence("Case report: a 34-year-old woman with RP", "")).toBe(
      "human_phenotype_natural_history"
    );
    expect(classifyEvidence("", "Twelve patients were enrolled in this cohort")).toBe(
      "human_phenotype_natural_history"
    );
  });

  it("falls back to other", () => {
    expect(classifyEvidence("Unrelated title", "unrelated abstract")).toBe("other");
  });

  // ---- Precedence regressions (retrieval spec, 2026-07-12) ----

  it("preclinical wins over incidental treatment language (AAV/therapy in bench work)", () => {
    // A mouse gene-therapy study is bench work, NOT human treatment evidence.
    expect(classifyEvidence("AAV gene therapy in a mouse model", "")).toBe(
      "preclinical_mechanism"
    );
  });

  it("a diagnostic cohort mentioning future gene therapy → human_phenotype_natural_history", () => {
    // The PMID 38892339 pattern (no PMID hard-coded): a genetic/diagnostic
    // cohort study whose only 'therapy' language is a forward-looking outlook.
    const title = "Genetic variants account for early-onset severe retinal dystrophy in a cohort";
    const abstract =
      "This study investigates the clinical and molecular architecture within a Chilean cohort of 67 patients and 60 families. Using panel sequencing, we identified disease-causing variants. These data hold value for future enrolment in gene therapy-based treatments and ongoing trials.";
    expect(classifyEvidence(title, abstract)).toBe("human_phenotype_natural_history");
  });

  it("a cohort mentioning clinical-trial eligibility → human_phenotype_natural_history", () => {
    const abstract =
      "We characterized a cohort of patients with inherited retinal disease. Several probands may be eligible for enrollment in clinical trials pending genetic confirmation.";
    expect(classifyEvidence("Phenotypic characterization of a patient cohort", abstract)).toBe(
      "human_phenotype_natural_history"
    );
  });

  it("an actual human gene-therapy trial → treatment_clinical", () => {
    const abstract =
      "In this phase 1/2 open-label clinical trial, patients received a subretinal injection of an AAV gene therapy vector. Safety and efficacy were evaluated and adverse events were recorded over 12 months.";
    expect(classifyEvidence("Gene therapy trial for X-linked RP", abstract)).toBe(
      "treatment_clinical"
    );
  });

  it("a meta-analysis of treatment trials → review", () => {
    const abstract =
      "We performed a meta-analysis of randomized controlled treatment trials evaluating the efficacy of gene therapy for inherited retinal disease.";
    expect(classifyEvidence("A meta-analysis of treatment trials", abstract)).toBe("review");
  });

  it("an AAV study in mice or cells → preclinical, not treatment_clinical", () => {
    expect(
      classifyEvidence(
        "AAV-mediated gene augmentation",
        "AAV gene therapy restored photoreceptor function in a mouse model of retinal degeneration"
      )
    ).toBe("preclinical_mechanism");
    expect(
      classifyEvidence("Gene delivery to patient-derived retinal organoids", "")
    ).toBe("preclinical_mechanism");
  });
});

describe("scoreLiteratureRecord", () => {
  it("scores higher when the gene symbol appears", () => {
    const withGene = scoreLiteratureRecord(
      { title: "RPGR mutations in RP", abstract: "", year: 2020 },
      "RPGR"
    );
    const withoutGene = scoreLiteratureRecord(
      { title: "Unrelated topic", abstract: "", year: 2020 },
      "RPGR"
    );
    expect(withGene).toBeGreaterThan(withoutGene);
  });

  it("scores natural-history/human evidence higher than preclinical (equal retinal context)", () => {
    // Both records carry the same retinal vocabulary so the retinal-term bonus
    // is equal and the category weight is what decides — the property under test.
    const human = scoreLiteratureRecord(
      { title: "GENEX", abstract: "A natural history study of patients with GENEX retinal dystrophy", year: 2020 },
      "GENEX"
    );
    const animal = scoreLiteratureRecord(
      { title: "GENEX", abstract: "A mouse model of GENEX retinal dystrophy", year: 2020 },
      "GENEX"
    );
    expect(human).toBeGreaterThan(animal);
  });

  it("scores recent papers higher than old ones", () => {
    const recent = scoreLiteratureRecord({ title: "", abstract: "", year: new Date().getFullYear() }, "X");
    const old = scoreLiteratureRecord({ title: "", abstract: "", year: 1990 }, "X");
    expect(recent).toBeGreaterThan(old);
  });

  it("does not error when year is missing", () => {
    expect(() => scoreLiteratureRecord({ title: "", abstract: "" }, "X")).not.toThrow();
  });
});

describe("dedupeLiterature (provenance-preserving)", () => {
  it("deduplicates by pmid, keeping the first occurrence", () => {
    const input = [
      rec({ pmid: "1", score: 5, title: "first" }),
      rec({ pmid: "1", score: 9, title: "duplicate" }),
      rec({ pmid: "2", score: 3, title: "second" }),
    ];
    const out = dedupeLiterature(input);
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.pmid === "1")?.title).toBe("first");
  });

  it("MERGES foundBy across duplicates (not keep-first-drop-rest)", () => {
    const input = [
      rec({ pmid: "1", foundBy: ["pubmed-broad"] }),
      rec({ pmid: "1", foundBy: ["pubmed-elink"] }),
      rec({ pmid: "1", foundBy: ["europepmc-focused"] }),
    ];
    const out = dedupeLiterature(input);
    expect(out).toHaveLength(1);
    expect(out[0].foundBy.sort()).toEqual(
      (["europepmc-focused", "pubmed-broad", "pubmed-elink"] as FoundBy[]).sort()
    );
  });

  it("does not duplicate a foundBy value already present", () => {
    const input = [
      rec({ pmid: "1", foundBy: ["pubmed-broad"] }),
      rec({ pmid: "1", foundBy: ["pubmed-broad"] }),
    ];
    const out = dedupeLiterature(input);
    expect(out[0].foundBy).toEqual(["pubmed-broad"]);
  });

  it("deduplicates by DOI across sources (PubMed + Europe PMC same paper)", () => {
    const input = [
      rec({ sourceId: "pubmed:1", pmid: "1", doi: "10.1000/xyz", source: "pubmed", foundBy: ["pubmed-broad"] }),
      rec({
        sourceId: "europepmc:99",
        pmid: undefined,
        doi: "10.1000/xyz",
        source: "europepmc",
        foundBy: ["europepmc-broad"],
      }),
    ];
    const out = dedupeLiterature(input);
    expect(out).toHaveLength(1);
    expect(out[0].sourceId).toBe("pubmed:1"); // first occurrence wins
    expect(out[0].foundBy.sort()).toEqual((["europepmc-broad", "pubmed-broad"] as FoundBy[]).sort());
  });

  it("deduplicates by normalized title when no PMID/DOI overlap exists", () => {
    const input = [
      rec({ sourceId: "pubmed:1", pmid: "1", title: "RPGR Gene Therapy: A Trial!" }),
      rec({
        sourceId: "europepmc:2",
        pmid: undefined,
        title: "rpgr gene therapy a trial",
      }),
    ];
    const out = dedupeLiterature(input);
    expect(out).toHaveLength(1);
  });

  it("does NOT sort or cap — that is selection's job", () => {
    const input = [
      rec({ pmid: "1", score: 2 }),
      rec({ pmid: "2", score: 9 }),
      rec({ pmid: "3", score: 5 }),
    ];
    const out = dedupeLiterature(input);
    // preserves input order, keeps all
    expect(out.map((r) => r.pmid)).toEqual(["1", "2", "3"]);
  });
});

describe("selectCategoryBalancedEvidence", () => {
  function catRec(id: string, category: EvidenceCategory, score: number): LiteratureRecord {
    return rec({ sourceId: `pubmed:${id}`, pmid: id, evidenceCategory: category, score });
  }

  it("respects the limit", () => {
    const input = Array.from({ length: 40 }, (_, i) =>
      catRec(String(i), "other", i)
    );
    const { selected, excluded } = selectCategoryBalancedEvidence(input, 20);
    expect(selected).toHaveLength(20);
    expect(excluded).toHaveLength(20);
  });

  it("marks every candidate selected true/false and gives excluded ones a reason", () => {
    const input = [
      catRec("1", "review", 10),
      catRec("2", "other", 1),
    ];
    const { selected, excluded } = selectCategoryBalancedEvidence(input, 1);
    expect(selected).toHaveLength(1);
    expect(selected[0].selected).toBe(true);
    expect(excluded).toHaveLength(1);
    expect(excluded[0].selected).toBe(false);
    expect(excluded[0].exclusionReason).toBeTruthy();
  });

  it("balances across categories rather than taking a flat top-N by score", () => {
    // 10 high-scoring 'other' records would crowd out everything in a flat
    // top-N; category balancing must still admit the lone review + preclinical.
    const input = [
      ...Array.from({ length: 10 }, (_, i) => catRec(`o${i}`, "other", 100 + i)),
      catRec("rev", "review", 5),
      catRec("pre", "preclinical_mechanism", 4),
    ];
    const { selected } = selectCategoryBalancedEvidence(input, 5);
    const cats = selected.map((r) => r.evidenceCategory);
    expect(cats).toContain("review");
    expect(cats).toContain("preclinical_mechanism");
  });

  it("fills remaining slots with highest-scoring leftovers regardless of category", () => {
    // Only 'other' records exist; balancing can't find the priority categories,
    // so pass 2 fills all slots by score.
    const input = [
      catRec("1", "other", 1),
      catRec("2", "other", 9),
      catRec("3", "other", 5),
    ];
    const { selected } = selectCategoryBalancedEvidence(input, 2);
    expect(selected.map((r) => r.pmid)).toEqual(["2", "3"]);
  });
});

describe("scoreTrialRecord", () => {
  it("scores gene-specific trials much higher than broader ones", () => {
    const specific = scoreTrialRecord(trial({ geneSpecific: true }));
    const broad = scoreTrialRecord(trial({ geneSpecific: false }));
    expect(specific).toBeGreaterThan(broad);
  });

  it("scores active/recruiting statuses higher than terminated/withdrawn", () => {
    const active = scoreTrialRecord(trial({ status: "RECRUITING" }));
    const terminated = scoreTrialRecord(trial({ status: "TERMINATED" }));
    expect(active).toBeGreaterThan(terminated);
  });

  it("does not zero out completed trials (still valuable evidence)", () => {
    const completed = scoreTrialRecord(trial({ status: "COMPLETED", geneSpecific: true }));
    expect(completed).toBeGreaterThan(0);
  });

  it("gives interventional trials a bonus over registries", () => {
    const interventional = scoreTrialRecord(trial({ studyType: "interventional" }));
    const registry = scoreTrialRecord(trial({ studyType: "registry" }));
    expect(interventional).toBeGreaterThan(registry);
  });
});

describe("rankAndCapTrials", () => {
  it("puts gene-specific, active trials first", () => {
    const input = [
      trial({ sourceId: "t1", nctId: "NCT1", geneSpecific: false, status: "TERMINATED" }),
      trial({ sourceId: "t2", nctId: "NCT2", geneSpecific: true, status: "RECRUITING" }),
      trial({ sourceId: "t3", nctId: "NCT3", geneSpecific: false, status: "COMPLETED" }),
    ];
    const out = rankAndCapTrials(input, 10);
    expect(out[0].nctId).toBe("NCT2");
  });

  it("does NOT send every raw trial once the cap is reached — weak ones are dropped, not just deprioritized", () => {
    const input = Array.from({ length: 40 }, (_, i) =>
      trial({ sourceId: `t${i}`, nctId: `NCT${i}`, geneSpecific: i < 5 })
    );
    const out = rankAndCapTrials(input, 15);
    expect(out).toHaveLength(15);
    expect(input.length).toBeGreaterThan(out.length);
  });

  it("caps to the default limit when none is specified", () => {
    const input = Array.from({ length: 30 }, (_, i) => trial({ sourceId: `t${i}`, nctId: `NCT${i}` }));
    expect(rankAndCapTrials(input).length).toBeLessThanOrEqual(15);
  });
});
