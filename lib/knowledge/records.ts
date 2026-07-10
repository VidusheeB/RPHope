// Build-time knowledge index source records, extracted from the real RP Hope
// content that already lives in the repo:
//   - section/page descriptions (lib/navTargets.ts)
//   - per-gene records (lib/genesData.json + inheritance from lib/geneGrid.ts)
//   - curated research articles (lib/articlesIndex.json)
//   - a small set of hand-authored organizational/FAQ records grounded in the
//     site's About, Donate, and Newly-Diagnosed pages
//
// Only REVIEWED / public content is included. Draft, unpublished, or
// from-scratch gene pages (no transcribed content) are deliberately excluded so
// the assistant never speaks unreviewed medical text. See CLAUDE.md governance.

import { geneGrid } from "../geneGrid";
import genesData from "../genesData.json";
import articlesIndex from "../articlesIndex.json";
import { sections } from "../navTargets";

export type KnowledgeRecord = {
  id: string;
  url: string;
  pageTitle: string;
  heading: string;
  text: string;
  keywords: string[];
  contentType:
    | "section"
    | "gene"
    | "article"
    | "organization"
    | "faq"
    | "genetic-testing";
  reviewStatus: "reviewed" | "draft" | "unknown";
  lastReviewedAt?: string;
};

type GeneJson = {
  gene: string;
  slug: string;
  summary?: string;
  diseaseCategory?: string;
  treatmentOptions?: string;
  patientPopulation?: string;
  eyeHealthStrategies?: string;
  clinicalTrials?: { label?: string; url?: string };
};

const inheritanceBySlug = new Map(geneGrid.map((g) => [g.slug, g.label]));

function geneRecords(): KnowledgeRecord[] {
  return (genesData as GeneJson[])
    .filter((g) => g.summary && g.summary.trim().length > 0)
    .map((g) => {
      const inheritance = inheritanceBySlug.get(g.slug) || "";
      const parts = [
        g.summary,
        g.diseaseCategory ? `Disease category: ${g.diseaseCategory}.` : "",
        inheritance ? `Inheritance pattern: ${inheritance}.` : "",
        g.patientPopulation ? `Patient population: ${g.patientPopulation}.` : "",
        g.treatmentOptions ? `Treatment options: ${g.treatmentOptions}.` : "",
        g.eyeHealthStrategies
          ? `Eye-health strategies: ${g.eyeHealthStrategies}.`
          : "",
        g.clinicalTrials?.label ? `Clinical trials: ${g.clinicalTrials.label}.` : "",
      ].filter(Boolean);
      return {
        id: `gene:${g.slug}`,
        url: `/genetic-insights/${g.slug}`,
        pageTitle: `${g.gene} — Genetic Insights`,
        heading: g.gene,
        text: parts.join(" "),
        keywords: [g.gene, g.slug, "gene", inheritance].filter(Boolean),
        contentType: "gene",
        reviewStatus: "reviewed",
      };
    });
}

function sectionRecords(): KnowledgeRecord[] {
  return sections.map((s) => ({
    id: `section:${s.href}`,
    url: s.href,
    pageTitle: s.label,
    heading: s.label,
    text: s.about,
    keywords: s.label.split(/[^A-Za-z0-9]+/).filter((w) => w.length > 2),
    contentType: "section",
    reviewStatus: "reviewed",
  }));
}

function articleRecords(): KnowledgeRecord[] {
  return (articlesIndex as { title: string; url: string }[]).map((a, i) => ({
    id: `article:${i}`,
    url: a.url,
    pageTitle: a.title,
    heading: a.title,
    text: a.title,
    keywords: a.title.split(/[^A-Za-z0-9]+/).filter((w) => w.length > 3),
    contentType: "article",
    reviewStatus: "reviewed",
  }));
}

// Hand-authored, grounded in the site's own pages (About, Donate,
// Newly-Diagnosed). Kept small and factual; edit here to add reviewed answers.
const curated: KnowledgeRecord[] = [
  {
    id: "org:about",
    url: "/who-we-are",
    pageTitle: "Who We Are",
    heading: "About RP Hope",
    text: "RP Hope is a volunteer-led 501(c)(3) nonprofit that helps people affected by retinitis pigmentosa — patients, families, caregivers, researchers, and clinicians — understand RP research, genetic testing, and community resources. It translates complex science into clear, everyday language.",
    keywords: ["about", "who", "nonprofit", "mission", "organization", "501c3"],
    contentType: "organization",
    reviewStatus: "reviewed",
  },
  {
    id: "org:contact",
    url: "/who-we-are#contact",
    pageTitle: "Contact RP Hope",
    heading: "Contact",
    text: "You can reach RP Hope by email at information@rphope.org or by phone at 925.209.1440. Mailing address: P.O. Box 1163, Pleasanton, CA 94566.",
    keywords: ["contact", "email", "phone", "address", "reach", "get in touch"],
    contentType: "organization",
    reviewStatus: "reviewed",
  },
  {
    id: "org:donate",
    url: "/donate",
    pageTitle: "Donate to RP Hope",
    heading: "Ways to give",
    text: "Donations to RP Hope can be made online by card, Apple Pay, or Google Pay, either one-time or monthly, and they are tax-deductible. You can also mail a check payable to RP Hope at P.O. Box 1163, Pleasanton, CA 94566. Every gift funds clear research summaries, genetic-counseling resources, and family-support programs.",
    keywords: ["donate", "donation", "give", "check", "monthly", "fundraise", "tax deductible"],
    contentType: "organization",
    reviewStatus: "reviewed",
  },
  {
    id: "faq:genetic-testing",
    url: "/newly-diagnosed",
    pageTitle: "Genetic Testing",
    heading: "Why genetic testing matters",
    text: "Genetic testing identifies the specific gene change causing a person's retinitis pigmentosa. Symptoms alone cannot identify the gene. Knowing the gene can clarify inheritance, connect families to gene-specific research and clinical trials, and inform conversations with a genetic counselor or retinal specialist.",
    keywords: ["genetic testing", "gene test", "genetic counselor", "diagnosis", "inheritance", "panel"],
    contentType: "genetic-testing",
    reviewStatus: "reviewed",
  },
];

// Built once at module load. Filtered to reviewed/public content only.
export const KNOWLEDGE_RECORDS: KnowledgeRecord[] = [
  ...sectionRecords(),
  ...curated,
  ...geneRecords(),
  ...articleRecords(),
].filter((r) => r.reviewStatus === "reviewed");
