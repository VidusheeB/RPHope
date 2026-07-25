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

/** How a trial record entered the bundle: the normal gene-name CT.gov search,
 *  or resolved directly from an NCT ID a selected publication named. */
export type TrialProvenance = "gene_search" | "discovered_from_literature";

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
  /** Defaults to "gene_search". "discovered_from_literature" means it was
   *  fetched directly by an NCT ID found in a selected paper. */
  provenance?: TrialProvenance;
  /** Publication source IDs that referenced this trial (when discovered from
   *  literature, or when a gene-search trial was ALSO named in a paper). */
  referencedBySourceIds?: string[];
};

/** An NCT ID a selected publication referenced that could NOT be resolved to a
 *  live ClinicalTrials.gov record. The citing publication is kept; the draft
 *  may state the registry record could not be verified, and must not present
 *  the trial's recruitment status as current. */
export type UnverifiedTrialReference = {
  nctId: string;
  referencedBySourceIds: string[];
  reason: string;
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
  /** NCT IDs a selected paper named but which could not be verified against
   *  ClinicalTrials.gov — the draft may note this, but must not state a
   *  recruitment status for them. Empty in the common case. */
  unverifiedTrialReferences: UnverifiedTrialReference[];
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

/** One sentence of drafted prose with the specific source ID(s) that support
 *  IT — not the whole section. This is what lets the review workspace show
 *  sentence-to-source verification instead of one citation list per
 *  paragraph. */
export type CitedSentence = { text: string; sourceIds: string[] };

/** A narrative section, broken into individually-cited sentences. Opus
 *  produces this shape directly (see schema.ts's `sentencedText`) — this is
 *  NOT a client-side re-split of a paragraph; the model is asked to attach
 *  citations per sentence at generation time. */
export type SentencedText = { sentences: CitedSentence[] };

/** Pre-migration shape, kept only so old gene_page_drafts rows (generated
 *  before sentence-level citations existed) still parse without crashing.
 *  Never produced by generation anymore — see normalizeSentencedText(). */
export type LegacySourcedText = { text: string; sourceIds: string[] };

/** Reads either the current { sentences: [...] } shape or a legacy
 *  { text, sourceIds } row, always returning the current shape. A legacy
 *  section becomes a single "sentence" spanning its whole original text —
 *  safe to render and review, just without per-sentence granularity until
 *  the gene is regenerated. */
export function normalizeSentencedText(raw: unknown): SentencedText {
  const value = raw as { sentences?: CitedSentence[]; text?: string; sourceIds?: string[] } | undefined;
  if (value?.sentences) return { sentences: value.sentences };
  if (typeof value?.text === "string") {
    return { sentences: [{ text: value.text, sourceIds: value.sourceIds ?? [] }] };
  }
  return { sentences: [] };
}

/** Flattened prose of a section, for contexts that just need to display or
 *  speak the text (the public gene page, read-aloud) rather than review it
 *  sentence by sentence. */
export function flattenSentencedText(value: SentencedText): string {
  return value.sentences.map((s) => s.text).join(" ");
}

/** Safe for ANY stored shape — old { text, sourceIds } rows (including
 *  already-published gene_page_versions.content written before sentence-
 *  level citations existed) or the current { sentences: [...] } shape.
 *  Prefer this over calling normalizeSentencedText + flattenSentencedText
 *  separately when the input's shape/vintage isn't already known. */
export function flattenAnySection(raw: unknown): string {
  return flattenSentencedText(normalizeSentencedText(raw));
}

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
  /** Everything below is added deterministically by generate.ts AFTER Opus
   *  responds, by looking the source ID up in the original evidence bundle
   *  (LiteratureRecord/TrialSummaryRecord) — never asked of the model, so
   *  there's no risk of a hallucinated PMID/DOI/year. Optional because they
   *  don't apply to every source type (e.g. ncbi-gene, rphope-resource). */
  authors?: string[];
  journal?: string;
  year?: number;
  pmid?: string;
  doi?: string;
  trialId?: string;
  abstract?: string;
  provenance?: "pubmed" | "europepmc" | "clinicaltrials" | "ncbi-gene" | "rphope-resource" | "web";
};

export type GenePageDraft = {
  gene: string;
  summaryCard: SentencedText;
  whatThisGeneMeans: SentencedText;
  howItMayAffectVision: SentencedText;
  whatIsKnown: SentencedText;
  whatIsUncertain: SentencedText;
  whatYouCanDoNext: SentencedText;
  questionsForClinician: string[];
  forFamilyAndCaregivers: SentencedText;
  treatmentAndResearch: SentencedText;
  clinicalTrialSummary: SentencedText;
  researchCards: ResearchCard[];
  sources: SourceCitation[];
  reviewFlags: string[];
  reviewStatus: "unreviewed";
  generatedAt: string;
};

/** The nine narrative section keys, in display order — used anywhere code
 *  needs to iterate "every sentenced section" instead of hardcoding the list
 *  (schema.ts, validate.ts, the review workspace). */
export const NARRATIVE_SECTION_KEYS: (keyof GenePageDraft)[] = [
  "summaryCard",
  "whatThisGeneMeans",
  "howItMayAffectVision",
  "whatIsKnown",
  "whatIsUncertain",
  "whatYouCanDoNext",
  "forFamilyAndCaregivers",
  "treatmentAndResearch",
  "clinicalTrialSummary",
];

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
