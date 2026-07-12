import { describe, it, expect } from "vitest";
import { assessRelevance } from "@/lib/geneResearch/relevance";

// The gate is conservative: it removes only records CLEARLY unrelated to the
// gene's retinal biology / inherited retinal disease. No PMID is hard-coded.

describe("assessRelevance (conservative post-retrieval gate)", () => {
  it("EXCLUDES an unrelated orthokeratology / myopia study (gene in a panel list)", () => {
    const v = assessRelevance({
      title: "Associations between RetNet gene polymorphisms and the efficacy of orthokeratology for myopia control",
      abstract:
        "We examined whether polymorphisms across a panel of genes predict axial elongation during orthokeratology for myopia control in children.",
    });
    expect(v.relevant).toBe(false);
    if (!v.relevant) expect(v.reason.toLowerCase()).toContain("off-topic");
  });

  it("RETAINS a broad inherited-retinal-disease cohort that includes the gene", () => {
    const v = assessRelevance({
      title: "Genetic and clinical profile of inherited retinal disease in a large cohort",
      abstract:
        "Panel sequencing of patients with Leber congenital amaurosis and retinitis pigmentosa identified disease-causing variants across many genes.",
    });
    expect(v.relevant).toBe(true);
  });

  it("RETAINS a mechanism paper with no 'retinitis pigmentosa' in the title", () => {
    const v = assessRelevance({
      title: "Knocking out lca5 in zebrafish impairs outer segment protein trafficking",
      abstract:
        "Loss of lebercilin disrupted transport to the photoreceptor outer segment, causing cone-rod dystrophy in the model.",
    });
    expect(v.relevant).toBe(true);
  });

  it("RETAINS a rare-phenotype paper", () => {
    const v = assessRelevance({
      title: "Novel variants extend the phenotype to cone dystrophy",
      abstract:
        "Two siblings showed cone dystrophy with reduced visual acuity and abnormal electroretinogram findings.",
    });
    expect(v.relevant).toBe(true);
  });

  it("RETAINS a gene-therapy paper", () => {
    const v = assessRelevance({
      title: "Gene augmentation restores function in a model of retinal degeneration",
      abstract: "Subretinal delivery of the gene improved photoreceptor survival and visual response.",
    });
    expect(v.relevant).toBe(true);
  });

  it("EXCLUDES a record with no retinal/IRD/phenotype/mechanism/treatment signal at all", () => {
    const v = assessRelevance({
      title: "The gene in hepatocellular carcinoma progression",
      abstract: "Expression correlated with tumor stage in liver cancer specimens.",
    });
    expect(v.relevant).toBe(false);
  });

  it("does NOT exclude a genuine IRD paper merely because it mentions myopia in passing", () => {
    const v = assessRelevance({
      title: "Retinitis pigmentosa with associated high myopia",
      abstract: "Patients with biallelic variants had rod-cone dystrophy; some also had myopia.",
    });
    expect(v.relevant).toBe(true);
  });
});
