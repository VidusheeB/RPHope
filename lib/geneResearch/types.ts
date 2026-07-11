// Shared types for the gene-page draft-generation pipeline (retrieval +
// Opus generation). See VOICE_ASSISTANT_SETUP.md-style docs in
// GENE_PAGE_PIPELINE.md for how to run this.

/** A verified NCBI Gene record — one of the four source inputs to the prompt. */
export type NcbiGeneRecord = {
  sourceId: string; // "ncbi-gene:<geneId>"
  geneId: string;
  symbol: string;
  officialFullName?: string;
  summary?: string;
  chromosome?: string;
  aliases: string[];
};

/** A PubMed record with abstract — ranked and deduplicated before prompting. */
export type PubMedRecord = {
  sourceId: string; // "pubmed:<pmid>"
  pmid: string;
  title: string;
  abstract: string;
  journal?: string;
  year?: number;
  url: string;
  score: number; // relevance score used for ranking (see rank.ts)
};

/** A ClinicalTrials.gov record, trimmed to what the prompt needs. */
export type TrialSummaryRecord = {
  sourceId: string; // "clinicaltrials:<nctId>"
  nctId: string;
  title: string;
  status: string;
  studyType?: string;
  geneSpecific: boolean;
  briefSummary?: string;
  url: string;
};

/** A small, hand-curated set of RP Hope-approved general resources. */
export type ApprovedResource = {
  sourceId: string; // "rphope-resource:<slug>"
  title: string;
  url: string;
  note: string;
};

export type ExistingApprovedPage = {
  gene: string;
  summary?: string;
  diseaseCategory?: string;
  treatmentOptions?: string;
} | null;

/** All source inputs assembled for one gene, ready to hand to Opus. */
export type GeneSourceBundle = {
  geneSymbol: string;
  geneSlug: string;
  geneRecord: NcbiGeneRecord | null;
  existingApprovedPage: ExistingApprovedPage;
  pubmedRecords: PubMedRecord[];
  trialRecords: TrialSummaryRecord[];
  approvedResources: ApprovedResource[];
};

// ---- Structured output shape (matches GENE_PAGE_SCHEMA) --------------------

export type SourcedText = { text: string; sourceIds: string[] };

export type ResearchCard = {
  title: string;
  whatWasStudied: string;
  whatWasFound: string;
  whyItMatters: string;
  evidenceType: string;
  limitation: string;
  sourceIds: string[];
};

export type SourceCitation = {
  id: string;
  type: "pubmed" | "clinicaltrials" | "ncbi-gene" | "rphope-resource";
  title: string;
  url: string;
};

export type GenePageDraft = {
  gene: string;
  summaryCard: SourcedText;
  whatThisGeneMeans: SourcedText;
  howItMayAffectVision: SourcedText;
  whatIsKnown: SourcedText;
  whatIsUncertain: SourcedText;
  whatYouCanDoNext: SourcedText;
  questionsForClinician: string[];
  forFamilyAndCaregivers: SourcedText;
  treatmentAndResearch: SourcedText;
  clinicalTrialSummary: SourcedText;
  researchCards: ResearchCard[];
  sources: SourceCitation[];
  reviewFlags: string[];
  reviewStatus: "unreviewed";
  generatedAt: string;
};

export type GenerationResult = {
  draft: GenePageDraft;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};
