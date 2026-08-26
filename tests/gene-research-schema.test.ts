import { describe, it, expect } from "vitest";
import { GENE_PAGE_SCHEMA, GENE_PAGE_TOP_LEVEL_FIELDS } from "@/lib/geneResearch/schema";
import { validateDraftSchemaOnly } from "@/lib/geneResearch/validate";
import { estimateCostUsd } from "@/lib/geneResearch/generate";
import { APPROVED_GENERAL_RESOURCES } from "@/lib/geneResearch/resources";

describe("GENE_PAGE_SCHEMA", () => {
  it("requires every top-level field from the pipeline spec", () => {
    expect(GENE_PAGE_SCHEMA.required).toEqual([...GENE_PAGE_TOP_LEVEL_FIELDS]);
  });

  it("declares a property for every required field (no drift)", () => {
    const propKeys = Object.keys(GENE_PAGE_SCHEMA.properties);
    for (const field of GENE_PAGE_SCHEMA.required) {
      expect(propKeys).toContain(field);
    }
  });

  it("does not use maxItems on array schemas (rejected by the live Structured Outputs API)", () => {
    // Confirmed against a real 400 response: "For 'array' type, property
    // 'maxItems' is not supported." The 5/6-item caps are enforced by the
    // prompt + lib/geneResearch/postprocess.ts instead — see schema.ts's note.
    const json = JSON.stringify(GENE_PAGE_SCHEMA);
    expect(json).not.toContain("maxItems");
  });

  it("locks reviewStatus to the single 'unreviewed' value", () => {
    expect(GENE_PAGE_SCHEMA.properties.reviewStatus.enum).toEqual(["unreviewed"]);
  });

  it("disallows additional top-level properties", () => {
    expect(GENE_PAGE_SCHEMA.additionalProperties).toBe(false);
  });

  it("every SentencedText-shaped field requires a sentences array of {text, sourceIds}", () => {
    for (const key of [
      "summaryCard",
      "whatThisGeneMeans",
      "howItMayAffectVision",
      "whatIsKnown",
      "whatIsUncertain",
      "whatYouCanDoNext",
      "forFamilyAndCaregivers",
      "treatmentAndResearch",
      "clinicalTrialSummary",
    ] as const) {
      // These nine sections are $ref'd rather than inlined — nine inline copies
      // blew past the Structured Outputs grammar-size ceiling (see schema.ts).
      // Follow the reference to check the shape it resolves to.
      const field = GENE_PAGE_SCHEMA.properties[key];
      expect(field).toEqual({ $ref: "#/$defs/sentencedText" });

      const sentenced = GENE_PAGE_SCHEMA.$defs.sentencedText;
      expect(sentenced.required).toEqual(["sentences"]);
      expect(sentenced.properties.sentences.items).toEqual({
        $ref: "#/$defs/citedSentence",
      });
      expect(GENE_PAGE_SCHEMA.$defs.citedSentence.required).toEqual([
        "text",
        "sourceIds",
      ]);
    }
  });
});

describe("estimateCostUsd", () => {
  it("matches the documented $5/M input, $25/M output pricing", () => {
    // 1,000,000 input + 0 output -> $5
    expect(estimateCostUsd(1_000_000, 0)).toBeCloseTo(5, 5);
    // 0 input + 1,000,000 output -> $25
    expect(estimateCostUsd(0, 1_000_000)).toBeCloseTo(25, 5);
  });

  it("is in the ballpark the pipeline spec estimates per gene", () => {
    // 8,000 input + 2,500 output ~ $0.1025 (spec: ~$11 / 107 genes ~ $0.103)
    const cost = estimateCostUsd(8000, 2500);
    expect(cost).toBeGreaterThan(0.09);
    expect(cost).toBeLessThan(0.12);
  });
});

describe("approved resources", () => {
  it("every approved resource has a stable sourceId and a URL", () => {
    expect(APPROVED_GENERAL_RESOURCES.length).toBeGreaterThan(0);
    for (const r of APPROVED_GENERAL_RESOURCES) {
      expect(r.sourceId).toMatch(/^rphope-resource:/);
      expect(r.url).toBeTruthy();
    }
  });
});

describe("sourceCitation type enum", () => {
  it("includes 'web' alongside the three structured databases and rphope-resource", () => {
    const json = JSON.stringify(GENE_PAGE_SCHEMA);
    expect(json).toContain('"web"');
  });
});

// The bug this guards against: generate.ts enriches each source with real
// bibliographic detail from the evidence bundle AFTER Opus responds, then
// validates. Validating that enriched object against the model-facing schema
// (additionalProperties: false, four allowed keys) rejected every single draft
// with "data/sources/N must NOT have additional properties" — five genes were
// generated and thrown away before anyone noticed. Ajv must accept what we
// actually save.
describe("validation schema vs. the model-facing schema", () => {
  const draft = (sources: unknown[]) => {
    const sentenced = { sentences: [{ text: "A sentence.", sourceIds: ["pubmed:1"] }] };
    const base: Record<string, unknown> = {
      gene: "RPGR",
      questionsForClinician: ["What does this mean for me?"],
      researchCards: [],
      sources,
      reviewFlags: [],
      reviewStatus: "unreviewed",
      generatedAt: "2026-08-25T00:00:00.000Z",
    };
    for (const k of [
      "summaryCard", "whatThisGeneMeans", "howItMayAffectVision", "whatIsKnown",
      "whatIsUncertain", "whatYouCanDoNext", "forFamilyAndCaregivers",
      "treatmentAndResearch", "clinicalTrialSummary",
    ]) base[k] = sentenced;
    return base;
  };

  const bare = { id: "pubmed:1", type: "pubmed", title: "A paper", url: "https://x.test" };
  const enriched = {
    ...bare,
    journal: "Nature",
    year: 2024,
    pmid: "12345",
    doi: "10.1/x",
    abstract: "Abstract text.",
    provenance: "pubmed",
  };

  it("accepts a draft whose sources have been enriched", () => {
    expect(validateDraftSchemaOnly(draft([enriched]))).toEqual({ ok: true });
  });

  it("still accepts an un-enriched draft", () => {
    expect(validateDraftSchemaOnly(draft([bare]))).toEqual({ ok: true });
  });

  it("accepts a trial source enriched with its NCT id", () => {
    const trial = {
      id: "clinicaltrials:NCT1", type: "clinicaltrials", title: "A study",
      url: "https://x.test", trialId: "NCT1", provenance: "clinicaltrials",
    };
    expect(validateDraftSchemaOnly(draft([trial]))).toEqual({ ok: true });
  });

  it("still rejects a genuinely unknown field", () => {
    const result = validateDraftSchemaOnly(draft([{ ...bare, madeUpField: "x" }]));
    expect(result.ok).toBe(false);
  });

  it("keeps the model-facing schema minimal, so Opus is never asked for them", () => {
    // Opus must not be asked to restate a PMID it could get wrong — that is the
    // whole reason enrichment exists.
    expect(Object.keys(GENE_PAGE_SCHEMA.properties.sources.items.properties)).toEqual([
      "id", "type", "title", "url",
    ]);
  });
});
