// Orchestrates one gene end-to-end: assemble source records (NCBI + PubMed +
// ClinicalTrials.gov + approved resources + existing approved page), generate
// the draft with Opus, and insert it into gene_page_drafts as 'unreviewed'.
//
// Runs genes as independent, sequential requests (never batched into one
// prompt) so a single failure doesn't take down the run — matches
// lib/research/pull.ts's per-gene insert pattern for the same reason.

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchNcbiGeneRecord } from "./ncbi";
import { fetchPubMedRecords } from "./pubmed";
import { fetchTrialSummaries } from "./trials";
import { APPROVED_GENERAL_RESOURCES, getExistingApprovedPage } from "./resources";
import { generateGenePage, GenerationError } from "./generate";
import type { GeneSourceBundle } from "./types";

export type GeneRunResult =
  | {
      geneSlug: string;
      geneSymbol: string;
      ok: true;
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
      reviewFlagCount: number;
    }
  | { geneSlug: string; geneSymbol: string; ok: false; error: string };

async function assembleSourceBundle(
  geneSymbol: string,
  geneSlug: string
): Promise<GeneSourceBundle> {
  const [geneRecord, pubmedRecords, trialRecords] = await Promise.all([
    fetchNcbiGeneRecord(geneSymbol),
    fetchPubMedRecords(geneSymbol),
    fetchTrialSummaries(geneSymbol),
  ]);

  return {
    geneSymbol,
    geneSlug,
    geneRecord,
    existingApprovedPage: getExistingApprovedPage(geneSlug),
    pubmedRecords,
    trialRecords,
    approvedResources: APPROVED_GENERAL_RESOURCES,
  };
}

/** Run the full pipeline for one gene and insert the resulting draft. */
export async function draftGenePage(
  supabase: SupabaseClient,
  geneSymbol: string,
  geneSlug: string
): Promise<GeneRunResult> {
  try {
    const bundle = await assembleSourceBundle(geneSymbol, geneSlug);
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
      return { geneSlug, geneSymbol, ok: false, error: `Supabase insert failed: ${error.message}` };
    }

    return {
      geneSlug,
      geneSymbol,
      ok: true,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      estimatedCostUsd: result.estimatedCostUsd,
      reviewFlagCount: d.reviewFlags.length,
    };
  } catch (err) {
    const message =
      err instanceof GenerationError || err instanceof Error
        ? err.message
        : "Unknown error";
    return { geneSlug, geneSymbol, ok: false, error: message };
  }
}
