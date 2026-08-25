import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/geneResearch/prompts";

// Collapse all runs of whitespace (incl. the prompt's hard line wraps) to
// single spaces, so assertions test WORDING, not where the paragraph happens
// to wrap. Production prompt text is never changed to satisfy a test.
const flat = (s: string) => s.replace(/\s+/g, " ").trim();
const FLAT_SYSTEM = flat(SYSTEM_PROMPT);

describe("generation prompt — patient-friendly prevalence rule (feature 3)", () => {
  it("instructs the model to describe gene frequency qualitatively in the main prose", () => {
    expect(FLAT_SYSTEM).toContain("describe gene frequency qualitatively");
  });

  it("tells the model NOT to stack population-specific prevalence percentages in the main prose", () => {
    expect(FLAT_SYSTEM.toLowerCase()).toContain(
      "do not place several population-specific prevalence percentages in the main prose"
    );
  });

  it("allows exact cohort percentages in a research card / source detail / review note", () => {
    expect(FLAT_SYSTEM).toContain("research card, source detail, or review note");
  });

  it("carries the qualitative frequency instruction into the per-gene requirements", () => {
    const prompt = buildUserPrompt({
      geneSymbol: "LCA5",
      evidenceTierBlock: "",
      geneRecordJson: "{}",
      literatureRecordsJson: "[]",
      clinicalTrialRecordsJson: "[]",
      approvedGeneralResourcesJson: "[]",
      webFallbackRecordsJson: "[]",
      unverifiedTrialReferencesJson: "[]",
    });
    expect(prompt).toContain("Describe gene frequency qualitatively");
  });
});

describe("generation prompt — unverified trial references (feature 1)", () => {
  it("includes an unverified_trial_references block in the user prompt", () => {
    const prompt = buildUserPrompt({
      geneSymbol: "LCA5",
      evidenceTierBlock: "",
      geneRecordJson: "{}",
      literatureRecordsJson: "[]",
      clinicalTrialRecordsJson: "[]",
      approvedGeneralResourcesJson: "[]",
      webFallbackRecordsJson: "[]",
      unverifiedTrialReferencesJson: '[{"nctId":"NCT05616793"}]',
    });
    expect(prompt).toContain("<unverified_trial_references>");
    expect(prompt).toContain("NCT05616793");
  });

  it("forbids stating a recruitment status for an unverified trial reference", () => {
    expect(FLAT_SYSTEM.toLowerCase()).toContain("registry record could not be");
  });
});
