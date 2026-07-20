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
  {
    id: "explainer:what-is-rp-hope",
    url: "/what-is-rp-hope",
    pageTitle: "What is RP Hope?",
    heading: "What is RP Hope",
    text: "RP Hope is a nonprofit for everyone touched by retinitis pigmentosa (RP) — patients, families, caregivers, researchers, and clinicians. It does three things: educates by gathering clear, jargon-free information about RP and where research stands; funds research seeking effective, affordable treatments for non-syndromic RP; and connects the community through events and shared stories. Its vision is a world where treatments for RP are effective and accessible to all patients.",
    keywords: ["what is rp hope", "about", "mission", "vision", "nonprofit", "who we are"],
    contentType: "organization",
    reviewStatus: "reviewed",
  },
  {
    id: "explainer:what-is-rp",
    url: "/what-is-rp",
    pageTitle: "What is retinitis pigmentosa (RP)?",
    heading: "What is RP",
    text: "Retinitis pigmentosa (RP) is a group of rare, inherited eye diseases that affect the retina, the light-sensitive layer at the back of the eye. In RP the retinal cells slowly break down over time, gradually reducing vision. The usual first sign is trouble seeing at night or in dim light, often in childhood; then side (peripheral) vision narrows, which can create tunnel vision. RP is caused by changes in genes that keep retinal cells healthy, and it can be inherited in autosomal recessive, autosomal dominant, or X-linked patterns. More than 80 genes are linked to RP. It is diagnosed with eye exams, visual field testing, an electroretinogram (ERG), OCT imaging, and genetic testing. There is no cure for most forms yet, but low-vision aids and rehabilitation help, one approved gene therapy exists for an RPE65-related form, and many gene and cell therapies are in clinical trials.",
    keywords: ["what is rp", "what is retinitis pigmentosa", "symptoms", "night vision", "peripheral vision", "inheritance", "diagnosis"],
    contentType: "faq",
    reviewStatus: "reviewed",
  },
  {
    id: "explainer:what-is-a-clinical-trial",
    url: "/what-is-a-clinical-trial",
    pageTitle: "What is a clinical trial?",
    heading: "What is a clinical trial",
    text: "A clinical trial is a carefully run research study that tests whether a new treatment is safe and whether it helps. There are two kinds of studies: interventional trials, where participants receive a specific treatment so researchers can measure its effect, and observational studies, where researchers follow people over time without giving a new treatment. Trials usually move through phases: Phase 1 tests safety in a small group; Phase 2 looks at whether it works and its side effects; Phase 3 confirms this in a much larger group; and Phase 4 tracks long-term safety after approval. A study's status shows whether people can join: recruiting means it is enrolling now; active, not recruiting means it is running but not enrolling; completed means it has finished; and preclinical research is earlier lab work not yet open to people. Every trial has eligibility criteria, and only the study team can confirm whether a trial fits a given person. RP Hope frames studies as 'may be relevant to review' — never as 'you qualify' or 'you are eligible' — and encourages bringing any trial to your own eye doctor and the study team.",
    keywords: ["what is a clinical trial", "clinical trial", "phases", "recruiting", "observational", "interventional", "eligibility", "may be relevant to review"],
    contentType: "faq",
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
