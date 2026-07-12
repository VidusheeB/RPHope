import { describe, it, expect } from "vitest";
import { GENE_PAGE_SCHEMA, GENE_PAGE_TOP_LEVEL_FIELDS } from "@/lib/geneResearch/schema";
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

  it("every SourcedText-shaped field requires text and sourceIds", () => {
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
      const field = GENE_PAGE_SCHEMA.properties[key];
      expect(field.required).toEqual(["text", "sourceIds"]);
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
