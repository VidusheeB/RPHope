// Shared types for the gene-page draft-generation pipeline (retrieval +
// one Opus structured-output call per gene). See GENE_PAGE_PIPELINE.md.
//
// Architecture (owner decision, 2026-07-11 — final):
//   1. Retrieve + verify evidence programmatically: NCBI Gene, PubMed,
//      Europe PMC, ClinicalTrials.gov, curated RP Hope resources.
//   2. Dedupe by PMID, DOI, and normalized title.
//   3. Rank + cap the evidence bundle before generation.
//   4. ONE Claude Opus 4.8 structured-output call per gene. No second
//      model-synthesis stage. Opus evaluates the supplied evidence and
//      drafts — it may not add facts from memory.
//   5. Reject the whole draft if: it cites an unknown source ID; required
//      retrieval failed; the human gene was not verified; or the structured
//      result fails validation.
//   6. Every draft saves as unreviewed (or rejected, with a reason).
//   Web search is NOT part of the main call. It is a separate, narrow,
//   domain-allowlisted retrieval step (max 3 searches), used only when the
//   deterministic evidence bundle is thin — see webSearchFallback.ts.

/** A retrieval call either succeeded (with zero or more records) or hard-
 *  failed (network/API error) — these are NOT the same thing. "Zero records"
 *  is legitimate evidence-thinness; a hard failure blocks generation (see
 *  validate.ts's "required retrieval failed" reject condition). */
export type RetrievalResult<T> =
  | { ok: true; records: T[] }
  | { ok: false; error: string };

/** NCBI gene verification is single-record and has three distinct states:
 *  found (verified real gene), not found (queried fine, no such gene), or a
 *  hard fetch failure. The first is required to proceed; the other two both
 *  reject the gene, but are logged with different reasons. */
export type GeneVerificationResult =
  | { ok: true; record: NcbiGeneRecord }
  | { ok: true; record: null } // verified query, gene not found
  | { ok: false; error: string }; // fetch itself failed

/** A verified NCBI Gene record. */
export type NcbiGeneRecord = {
  sourceId: string; // "ncbi-gene:<geneId>"
  geneId: string;
  symbol: string;
  officialFullName?: string;
  summary?: string;
  chromosome?: string;
  aliases: string[];
};

/** The 5-bucket evidence taxonomy used for category-balanced selection, per
 *  the retrieval spec exactly: human phenotype/natural-history evidence,
 *  reviews, treatment/clinical evidence, laboratory/animal mechanisms, and
 *  "other" (additional highest-relevance evidence that doesn't fit the first
 *  four buckets). This is a RETRIEVAL-layer heuristic (keyword-based), not
 *  ground truth — the prompt instructs Opus to verify against the actual
 *  abstract text, not trust the tag blindly. */
export type EvidenceCategory =
  | "human_phenotype_natural_history"
  | "review"
  | "treatment_clinical"
  | "preclinical_mechanism"
  | "other";

/** Which query/source found a candidate — a candidate can be found by more
 *  than one (e.g. both PubMed's broad search AND ELink), which is itself a
 *  relevance signal preserved through dedup, not discarded. */
export type FoundBy =
  | "pubmed-broad"
  | "pubmed-focused"
  | "pubmed-elink"
  | "europepmc-broad"
  | "europepmc-focused";

/** A literature record from PubMed or Europe PMC — unified shape so cross-
 *  source dedup (PMID, DOI, normalized title) operates on one list. Carries
 *  full retrieval provenance (which quer(y/ies) found it, which term
 *  matched) and, after selection, whether it was kept and why/why not — this
 *  is exactly what the retrieve-only diagnostic reports per candidate. */
export type LiteratureRecord = {
  sourceId: string; // "pubmed:<pmid>" or "europepmc:<id>"
  source: "pubmed" | "europepmc";
  pmid?: string;
  doi?: string;
  title: string;
  abstract: string;
  journal?: string;
  year?: number;
  url: string;
  evidenceCategory: EvidenceCategory;
  score: number; // relevance score used for ranking (see rank.ts)
  /** Every query that surfaced this candidate (merged across dedup). */
  foundBy: FoundBy[];
  /** The gene term (symbol/alias/full name) that matched a text search, if
   *  any — undefined for a pure ELink-only find (not a text match). */
  matchedTerm?: string;
  /** Set by the category-balanced selection step (rank.ts). Undefined before
   *  selection has run. */
  selected?: boolean;
  /** Populated when selected === false. */
  exclusionReason?: string;
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

/** A web-search-fallback result — used ONLY to fill an explicitly identified
 *  evidence gap (current FDA/trial/university/company updates not yet in
 *  PubMed/Europe PMC/ClinicalTrials.gov), restricted to an approved domain
 *  allowlist, max 3 per gene. Tagged distinctly (sourceCitation type "web")
 *  so downstream governance holds it to a different confidence bar than the
 *  structured databases.
 *
 *  `snippet` is REQUIRED and must be real retrieved page text, not a title
 *  restated — per the retrieval spec: "A title and URL alone are
 *  insufficient evidence." A result with no real captured text is dropped,
 *  never included with an empty/placeholder snippet. */
export type WebSearchRecord = {
  sourceId: string; // "web:<n>"
  title: string;
  url: string;
  domain: string;
  snippet: string;
};

/** All source inputs assembled for one gene, ready for the single generation
 *  call. No "existing approved page" input (owner decision, 2026-07-11): old
 *  RP Hope page content is never used, even as reference. */
export type GeneSourceBundle = {
  geneSymbol: string;
  geneSlug: string;
  geneRecord: NcbiGeneRecord;
  literatureRecords: LiteratureRecord[];
  trialRecords: TrialSummaryRecord[];
  approvedResources: ApprovedResource[];
  webFallbackRecords: WebSearchRecord[];
};

/** All valid source IDs a draft may cite — used by validate.ts to reject a
 *  draft that references an ID not actually in the supplied bundle. */
export function allValidSourceIds(bundle: GeneSourceBundle): Set<string> {
  return new Set([
    bundle.geneRecord.sourceId,
    ...bundle.literatureRecords.map((r) => r.sourceId),
    ...bundle.trialRecords.map((r) => r.sourceId),
    ...bundle.approvedResources.map((r) => r.sourceId),
    ...bundle.webFallbackRecords.map((r) => r.sourceId),
  ]);
}

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
  type: "pubmed" | "europepmc" | "clinicaltrials" | "ncbi-gene" | "rphope-resource" | "web";
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

// ---- Rejection ---------------------------------------------------------

export type RejectReason =
  | { code: "unknown_source_id"; detail: string }
  | { code: "required_retrieval_failed"; detail: string }
  | { code: "gene_not_verified"; detail: string }
  | { code: "schema_validation_failed"; detail: string };

export type ValidationResult =
  | { ok: true }
  | { ok: false; reasons: RejectReason[] };
