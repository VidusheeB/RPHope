// Orchestrates one gene end-to-end:
//   1. Verify the human gene against NCBI Gene (required — reject if it
//      fails or the gene isn't found).
//   2. Build the search-term set from the verified record (official symbol,
//      official full name, safe aliases — see aliases.ts).
//   3. High-recall literature retrieval (retrieval spec, 2026-07-12):
//        a. NCBI ELink Gene-to-PubMed curated associations (best-effort — a
//           high-precision complement, not required);
//        b. PubMed broad + focused searches (required);
//        c. Europe PMC broad + focused searches (required);
//        d. ClinicalTrials.gov (required).
//      A hard failure from PubMed / Europe PMC / ClinicalTrials.gov (not just
//      "zero results") is "required retrieval failed" and rejects the gene
//      before spending on generation. ELink failing is logged and skipped.
//   4. Merge all literature candidates, dedupe (PMID/DOI/title, merging
//      retrieval provenance), then CATEGORY-BALANCED selection — not a flat
//      top-N — down to the evidence cap. Ranking, not a disease-keyword gate,
//      is what narrows the field (see rank.ts).
//   5. If the SELECTED evidence is thin, run the capped, domain-allowlisted
//      web-search fallback to fill the gap.
//   6. ONE Opus generation call. Validate/reject per the spec's four
//      conditions (see generate.ts + validate.ts).
//   7. Save as 'unreviewed' on success. Rejections are reported but NOT
//      saved — gene_page_drafts only ever holds real, valid draft content.
//
// assembleSourceBundle also returns full retrieval DIAGNOSTICS (every
// deduplicated candidate, selected or not, with its provenance and
// selection reason) separate from the bundle Opus actually sees — that
// powers --retrieve-only's per-candidate report without bloating the
// generation prompt.
//
// NCBI-bound calls (gene lookup, ELink, PubMed) all share
// eutils.ncbi.nlm.nih.gov's rate limit (3 req/sec without NCBI_API_KEY) and
// are time-spaced by ncbiThrottle.ts; Europe PMC and ClinicalTrials.gov are
// separate hosts and run in parallel once the NCBI-bound work is done.

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchNcbiGeneRecord } from "./ncbi";
import { getSearchTerms } from "./aliases";
import { getCatalogGene } from "../geneCatalog";
import { fetchGeneToPubmedElink } from "./elink";
import { fetchPubMedRecords, fetchPubMedRecordsByPmid } from "./pubmed";
import { fetchEuropePmcRecords } from "./europepmc";
import { fetchTrialSummaries, mergeLiteratureReferencedTrials } from "./trials";
import { collectNctReferences } from "./nct";
import { assessRelevance } from "./relevance";
import { APPROVED_GENERAL_RESOURCES } from "./resources";
import {
  dedupeLiterature,
  selectCategoryBalancedEvidence,
  rankAndCapTrials,
} from "./rank";
import { isEvidenceThin, fetchWebSearchFallback } from "./webSearchFallback";
import {
  generateGenePage,
  GenerationError,
  DraftRejectedError,
  estimateCostBeforeGeneration,
} from "./generate";
import type {
  GeneSourceBundle,
  LiteratureRecord,
  RejectReason,
} from "./types";

const LITERATURE_LIMIT = 25;
const TRIAL_LIMIT = 15;
// Cap ELink's curated PMID list before fetching abstracts — the spec's "up to
// 100 candidates from each source" applies to ELink too.
const ELINK_PMID_LIMIT = 100;

/** Full retrieval provenance for one gene — every deduplicated candidate
 *  (selected or excluded) plus source-level counts and the term set used.
 *  This is what --retrieve-only reports on; it is NOT sent to Opus (only the
 *  selected records, inside the bundle, are). */
export type RetrievalDiagnostics = {
  geneSymbol: string;
  geneId: string;
  searchTerms: string[];
  safeAliases: string[];
  excludedAliases: string[];
  /** Raw record counts per source, BEFORE cross-source dedup. */
  rawCounts: { pubmed: number; pubmedElink: number; europepmc: number };
  elinkPmidCount: number;
  candidateCount: number; // after dedup, before the relevance gate
  /** Records removed by the conservative relevance gate (clearly off-topic). */
  relevanceExcludedCount: number;
  selectedCount: number;
  webFallbackCount: number;
  /** NCT IDs found in the selected literature, and how each resolved. */
  nctIdsExtracted: string[];
  nctResolved: string[]; // fetched directly from CT.gov and merged as trials
  nctUnverified: string[]; // referenced but CT.gov couldn't return them
  /** Every deduplicated candidate, each with foundBy / matchedTerm / score /
   *  evidenceCategory / selected / exclusionReason populated (gate-excluded
   *  records carry a "Relevance gate: …" reason). */
  candidates: LiteratureRecord[];
};

export type BundleResult =
  | { ok: true; bundle: GeneSourceBundle; diagnostics: RetrievalDiagnostics }
  | { ok: false; reasons: RejectReason[] };

/** Steps 1-5: retrieve, verify, dedupe/select, and (if needed) fall back to a
 *  bounded web search. Zero Anthropic usage except the OPTIONAL web-search
 *  fallback call — used by both the full pipeline and --retrieve-only mode.
 *  (--retrieve-only passes skipWebFallback to guarantee $0 Anthropic spend.) */
export async function assembleSourceBundle(
  geneSymbol: string,
  geneSlug: string,
  opts: { skipWebFallback?: boolean } = {}
): Promise<BundleResult> {
  // Step 1: NCBI gene verification (required).
  const geneResult = await fetchNcbiGeneRecord(geneSymbol);
  if (!geneResult.ok) {
    return {
      ok: false,
      reasons: [
        { code: "required_retrieval_failed", detail: `NCBI gene lookup failed: ${geneResult.error}` },
      ],
    };
  }
  if (!geneResult.record) {
    return {
      ok: false,
      reasons: [{ code: "gene_not_verified", detail: `No NCBI Gene record found for symbol "${geneSymbol}".` }],
    };
  }
  const geneRecord = geneResult.record;

  // Step 2: build the search-term set from the verified record, then fold in
  // the hand-verified aliases from lib/geneCatalog.ts. NCBI's "Also known as"
  // list is the primary source and is always current, but the sheet's column B
  // was checked against HGNC / NCBI GTR / GeneReviews and occasionally carries
  // a symbol NCBI does not list (searching CFAP418 without C8orf37 misses a
  // decade of research). Union, deduplicated case-insensitively.
  const catalogGene = getCatalogGene(geneSlug);
  const catalogAliases = catalogGene?.aliases ?? [];
  const diseaseTerms = catalogGene?.diseaseTerms ?? [];

  const base = getSearchTerms(geneRecord);
  const seenTerm = new Set(base.allTerms.map((t) => t.toLowerCase()));
  const addedAliases = catalogAliases.filter((a) => {
    const k = a.toLowerCase();
    if (seenTerm.has(k)) return false;
    seenTerm.add(k);
    return true;
  });
  const allTerms = [...base.allTerms, ...addedAliases];
  const safeAliases = [...base.safeAliases, ...addedAliases];
  const excludedAliases = base.excludedAliases;

  // Step 3a: ELink Gene-to-PubMed (NCBI-bound, best-effort). A curated
  // association list — high precision, but a transient failure here must not
  // block a gene whose text searches succeed, so we log and continue.
  const elinkResult = await fetchGeneToPubmedElink(geneRecord.geneId);
  const elinkPmids = elinkResult.ok ? elinkResult.pmids.slice(0, ELINK_PMID_LIMIT) : [];
  if (!elinkResult.ok) {
    console.warn(`  [pipeline] ELink skipped for ${geneSymbol}: ${elinkResult.error}`);
  }

  // Step 3b: PubMed broad + focused text searches (NCBI-bound, required).
  const pubmedResult = await fetchPubMedRecords(geneRecord.symbol, allTerms);
  if (!pubmedResult.ok) {
    return {
      ok: false,
      reasons: [{ code: "required_retrieval_failed", detail: `PubMed search failed: ${pubmedResult.error}` }],
    };
  }

  // Step 3c: fetch abstracts for the ELink PMIDs (NCBI-bound). Best-effort —
  // an efetch hiccup here shouldn't sink the gene when the text searches
  // succeeded; log and proceed with what we have.
  const elinkRecordsResult = await fetchPubMedRecordsByPmid(elinkPmids, geneRecord.symbol);
  const elinkRecords = elinkRecordsResult.ok ? elinkRecordsResult.records : [];
  if (!elinkRecordsResult.ok) {
    console.warn(`  [pipeline] ELink abstract fetch skipped for ${geneSymbol}: ${elinkRecordsResult.error}`);
  }

  // Step 3d: Europe PMC (broad + focused) and ClinicalTrials.gov — separate
  // hosts, run in parallel now the NCBI-bound calls are done.
  const [europePmcResult, trialsResult] = await Promise.all([
    fetchEuropePmcRecords(geneRecord.symbol, allTerms),
    fetchTrialSummaries(geneSymbol, diseaseTerms, allTerms),
  ]);
  if (!europePmcResult.ok) {
    return {
      ok: false,
      reasons: [{ code: "required_retrieval_failed", detail: `Europe PMC search failed: ${europePmcResult.error}` }],
    };
  }
  if (!trialsResult.ok) {
    return {
      ok: false,
      reasons: [{ code: "required_retrieval_failed", detail: `ClinicalTrials.gov search failed: ${trialsResult.error}` }],
    };
  }

  // Step 4: merge all literature candidates, dedupe (merging foundBy
  // provenance across duplicates), then apply the conservative relevance gate
  // BEFORE category-balanced selection, so a clearly-unrelated paper never
  // consumes a selection slot. Gate-excluded records are kept in diagnostics
  // (with source ID, matched term, original score, exclusion reason) but not
  // sent to Opus.
  const merged = [...pubmedResult.records, ...elinkRecords, ...europePmcResult.records];
  const candidates = dedupeLiterature(merged);

  const relevant: LiteratureRecord[] = [];
  const gateExcluded: LiteratureRecord[] = [];
  for (const c of candidates) {
    const verdict = assessRelevance(c, diseaseTerms);
    if (verdict.relevant) {
      relevant.push(c);
    } else {
      c.selected = false;
      c.exclusionReason = `Relevance gate: ${verdict.reason}`;
      gateExcluded.push(c);
    }
  }

  const { selected } = selectCategoryBalancedEvidence(relevant, LITERATURE_LIMIT);

  // Step 4b: extract NCT IDs from the SELECTED literature and resolve each
  // DIRECTLY from ClinicalTrials.gov (not another gene search), then merge with
  // the gene-search trials (dedup by NCT ID, prefer the direct registry
  // record). NCT IDs a paper named but CT.gov can't return become "unverified"
  // references — the citing paper stays, but no live trial is asserted.
  const nctReferences = collectNctReferences(
    selected.map((r) => ({ sourceId: r.sourceId, title: r.title, abstract: r.abstract }))
  );
  const geneSearchTrials = rankAndCapTrials(trialsResult.records, TRIAL_LIMIT);
  const {
    merged: mergedTrials,
    unverified: unverifiedTrialReferences,
    excluded: literatureExcludedTrials,
  } = await mergeLiteratureReferencedTrials(
    geneSearchTrials,
    nctReferences,
    geneSymbol,
    allTerms
  );
  // Internal audit only — other-gene studies must never reach the prompt.
  const excludedTrials = [...trialsResult.excluded, ...literatureExcludedTrials];
  if (excludedTrials.length) {
    console.warn(
      `  [trials] excluded ${excludedTrials.length} other-gene study(ies): ` +
        excludedTrials.map((e) => `${e.nctId} (${e.targetGenes.join("/")})`).join(", ")
    );
  }
  // Re-rank/cap after merging in literature-discovered trials so a paper-named
  // trial the gene search missed can still surface within the cap.
  const trialRecords = rankAndCapTrials(mergedTrials, TRIAL_LIMIT);

  // Step 5: web-search fallback, ONLY if the SELECTED evidence is thin (and
  // never in --retrieve-only mode, which guarantees zero Anthropic spend).
  const webFallbackRecords =
    !opts.skipWebFallback && isEvidenceThin(selected.length, trialRecords.length)
      ? await fetchWebSearchFallback(geneSymbol)
      : [];

  const diagnostics: RetrievalDiagnostics = {
    geneSymbol: geneRecord.symbol,
    geneId: geneRecord.geneId,
    searchTerms: allTerms,
    safeAliases,
    excludedAliases,
    rawCounts: {
      pubmed: pubmedResult.records.length,
      pubmedElink: elinkRecords.length,
      europepmc: europePmcResult.records.length,
    },
    elinkPmidCount: elinkPmids.length,
    candidateCount: candidates.length,
    relevanceExcludedCount: gateExcluded.length,
    selectedCount: selected.length,
    webFallbackCount: webFallbackRecords.length,
    nctIdsExtracted: nctReferences.map((r) => r.nctId),
    nctResolved: trialRecords
      .filter((t) => t.provenance === "discovered_from_literature")
      .map((t) => t.nctId),
    nctUnverified: unverifiedTrialReferences.map((u) => u.nctId),
    // gate-excluded first (with their reasons), then the ranked candidate pool.
    candidates: [...gateExcluded, ...relevant],
  };

  return {
    ok: true,
    bundle: {
      geneSymbol: geneRecord.symbol,
      geneSlug,
      geneRecord,
      evidence: catalogGene
        ? { tier: catalogGene.evidenceTier, framingNote: catalogGene.framingNote }
        : null,
      literatureRecords: selected,
      trialRecords,
      approvedResources: APPROVED_GENERAL_RESOURCES,
      webFallbackRecords,
      unverifiedTrialReferences,
    },
    diagnostics,
  };
}

export type GeneRunResult =
  | {
      geneSlug: string;
      geneSymbol: string;
      outcome: "ok";
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
      reviewFlagCount: number;
    }
  | {
      geneSlug: string;
      geneSymbol: string;
      outcome: "rejected";
      reasons: RejectReason[];
      /** Real spend if the rejection happened AFTER a billed Opus response
       *  (post-generation validation). Absent for a pre-generation rejection
       *  (bundle assembly), which costs nothing — but note that path is
       *  handled in draftGenePage, not here; a rejection FROM
       *  generateAndSaveDraft is always post-generation and always billed. */
      inputTokens?: number;
      outputTokens?: number;
      estimatedCostUsd?: number;
    }
  | {
      geneSlug: string;
      geneSymbol: string;
      outcome: "failed";
      error: string;
      /** Present if the failure happened after a billed response. */
      inputTokens?: number;
      outputTokens?: number;
      estimatedCostUsd?: number;
    };

/** Step 6-7 only: generate from an ALREADY-ASSEMBLED bundle and save on
 *  success. Split out from draftGenePage so a caller (the CLI) can inspect
 *  the bundle and its pre-call cost estimate — and gate on a budget check —
 *  BEFORE the Opus call happens, not just observe it in passing. */
export async function generateAndSaveDraft(
  supabase: SupabaseClient,
  bundle: GeneSourceBundle
): Promise<GeneRunResult> {
  const { geneSymbol, geneSlug } = bundle;
  try {
    const result = await generateGenePage(bundle);
    const d = result.draft;

    const { error } = await supabase.from("gene_page_drafts").insert({
      gene_slug: geneSlug,
      gene_symbol: geneSymbol,
      summary_card: d.summaryCard,
      what_this_gene_means: d.whatThisGeneMeans,
      how_it_may_affect_vision: d.howItMayAffectVision,
      what_is_known: d.whatIsKnown,
      what_is_uncertain: d.whatIsUncertain,
      what_you_can_do_next: d.whatYouCanDoNext,
      questions_for_clinician: d.questionsForClinician,
      for_family_and_caregivers: d.forFamilyAndCaregivers,
      treatment_and_research: d.treatmentAndResearch,
      clinical_trial_summary: d.clinicalTrialSummary,
      research_cards: d.researchCards,
      sources: d.sources,
      review_flags: d.reviewFlags,
      review_status: "unreviewed",
      generated_at: d.generatedAt,
      model: "claude-opus-4-8",
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      estimated_cost_usd: result.estimatedCostUsd,
    });

    if (error) {
      return { geneSlug, geneSymbol, outcome: "failed", error: `Supabase insert failed: ${error.message}` };
    }

    return {
      geneSlug,
      geneSymbol,
      outcome: "ok",
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd: result.estimatedCostUsd,
      reviewFlagCount: d.reviewFlags.length,
    };
  } catch (err) {
    if (err instanceof DraftRejectedError) {
      // The draft is thrown away, but the Opus call was billed — surface the
      // real usage so the CLI can report it AND count it toward --max-cost.
      return {
        geneSlug,
        geneSymbol,
        outcome: "rejected",
        reasons: err.reasons,
        inputTokens: err.usage.inputTokens,
        outputTokens: err.usage.outputTokens,
        estimatedCostUsd: err.usage.estimatedCostUsd,
      };
    }
    if (err instanceof GenerationError) {
      // usage is present only when the failure came after a billed response.
      return {
        geneSlug,
        geneSymbol,
        outcome: "failed",
        error: err.message,
        inputTokens: err.usage?.inputTokens,
        outputTokens: err.usage?.outputTokens,
        estimatedCostUsd: err.usage?.estimatedCostUsd,
      };
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return { geneSlug, geneSymbol, outcome: "failed", error: message };
  }
}

/** Run the full pipeline for one gene and insert the resulting draft (success
 *  only — rejections and failures are reported but not saved; see header).
 *  Composition of assembleSourceBundle + generateAndSaveDraft for the common
 *  multi-gene batch case; use the two functions directly for a budget check
 *  between retrieval and generation (see scripts/gene-pages-draft.ts). */
export async function draftGenePage(
  supabase: SupabaseClient,
  geneSymbol: string,
  geneSlug: string,
  onBundleReady?: (
    bundle: GeneSourceBundle,
    estimate: ReturnType<typeof estimateCostBeforeGeneration>,
    diagnostics: RetrievalDiagnostics
  ) => void
): Promise<GeneRunResult> {
  const bundleResult = await assembleSourceBundle(geneSymbol, geneSlug);
  if (!bundleResult.ok) {
    return { geneSlug, geneSymbol, outcome: "rejected", reasons: bundleResult.reasons };
  }
  if (onBundleReady) {
    onBundleReady(
      bundleResult.bundle,
      estimateCostBeforeGeneration(bundleResult.bundle),
      bundleResult.diagnostics
    );
  }
  return generateAndSaveDraft(supabase, bundleResult.bundle);
}

/** Check Supabase for an existing draft — used for resume support (skip
 *  genes that already have a saved row unless --force is passed). */
export async function hasExistingDraft(
  supabase: SupabaseClient,
  geneSlug: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("gene_page_drafts")
    .select("id")
    .eq("gene_slug", geneSlug)
    .limit(1);
  if (error) return false; // fail open — don't block a run over a lookup hiccup
  return Boolean(data && data.length > 0);
}
