// Gene data for the detail pages.
//
// Loaded from genesData.json, which is extracted from the live RP Hope gene pages
// (rphope.org/genetic-insights-*) — real content: Disease Category, Patient
// Population, Clinical Trials, Treatment Options, Strategies, Institutions, Face of
// RP, and Brief Description. Regenerate with scripts (see the scrape in git history).
//
// CONTENT GOVERNANCE: summaries are paraphrases/quotes from the live site and should
// be treated as pending medical review before being treated as authoritative.

import raw from "./genesData.json";

export type ClinicalTrials = { label: string; url?: string };
export type FaceOfRP = { name: string; location?: string };

export type Gene = {
  slug: string;
  gene: string;
  fullName?: string;
  diseaseCategory: string; // as labeled on the live site (holds inheritance pattern)
  patientPopulation?: string;
  clinicalTrials?: ClinicalTrials;
  treatmentOptions?: string;
  eyeHealthStrategies?: string;
  institutions?: string[];
  faceOfRP?: FaceOfRP;
  summary: string;
};

export const genes: Gene[] = (raw as Gene[]).map((g) => ({
  ...g,
  summary:
    g.summary ||
    `${g.gene} is a gene associated with retinitis pigmentosa. A plain-English summary is being prepared.`,
}));

export function getGene(slug: string): Gene | undefined {
  return genes.find((g) => g.slug === slug);
}
