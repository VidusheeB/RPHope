// The per-gene Opus call. ONE independent structured-output request per gene
// — never batched across genes, no second model-synthesis stage, no tools
// attached (web search, when used at all, is a separate retrieval step that
// ran earlier — see webSearchFallback.ts; its results arrive here as ordinary
// supplied records). Opus evaluates the pre-assembled evidence bundle and
// drafts from it in a single call.
//
// Uses the beta Messages API for adaptive thinking + Structured Outputs
// (output_config) — verified against the installed @anthropic-ai/sdk's beta
// type definitions before writing this, not assumed from memory. A prior
// design combined this schema with a live web_search tool in the same call
// and hit a real, confirmed API limit ("The compiled grammar is too large...
// Simplify your tool schemas or reduce the number of strict tools") — that is
// why no tool is attached here; the final architecture moved web search to
// its own separate, narrow retrieval call instead.
//
// The system prompt is cached (cache_control: ephemeral) so running this
// across many genes only pays full input-token price once for that block;
// every subsequent gene's call hits the cache.

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserPrompt, buildEvidenceTierBlock } from "./prompts";
import { GENE_PAGE_SCHEMA } from "./schema";
import { enforceLimits } from "./postprocess";
import { validateDraft } from "./validate";
import type {
  GeneSourceBundle,
  GenePageDraft,
  GenerationResult,
  RejectReason,
  SourceCitation,
} from "./types";

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 12000;

// Standard pricing (not batch): $5/M input, $25/M output. Update if pricing
// changes.
const INPUT_PRICE_PER_M = 5;
const OUTPUT_PRICE_PER_M = 25;

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * INPUT_PRICE_PER_M +
    (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_M
  );
}

// Rough pre-call estimate from the assembled bundle's size, printed by the
// CLI BEFORE spending anything so a surprisingly large bundle is visible in
// advance. ~4 characters/token is a standard rough heuristic; output is
// estimated from the schema's own typical range (900-1,400 words of prose
// plus structured fields) rather than measured, since it hasn't been
// generated yet.
const CHARS_PER_TOKEN = 4;
const SYSTEM_PROMPT_TOKENS = Math.ceil(SYSTEM_PROMPT.length / CHARS_PER_TOKEN);
const ESTIMATED_OUTPUT_TOKENS = 4500;

export function estimateCostBeforeGeneration(bundle: GeneSourceBundle): {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
  /** Worst-case ceiling: input estimate unchanged, output assumed to hit
   *  MAX_TOKENS (the hard cap the API call is configured with). This is the
   *  number to check against a --max-cost budget, not the typical estimate
   *  above, since a budget guard must not be based on an optimistic guess. */
  estimatedMaxCostUsd: number;
} {
  const bundleJsonLength =
    JSON.stringify(bundle.geneRecord).length +
    JSON.stringify(bundle.literatureRecords).length +
    JSON.stringify(bundle.trialRecords).length +
    JSON.stringify(bundle.approvedResources).length +
    JSON.stringify(bundle.webFallbackRecords).length +
    JSON.stringify(bundle.unverifiedTrialReferences).length;
  const estimatedInputTokens =
    SYSTEM_PROMPT_TOKENS + Math.ceil(bundleJsonLength / CHARS_PER_TOKEN) + 500; // +500 for prompt scaffolding
  return {
    estimatedInputTokens,
    estimatedOutputTokens: ESTIMATED_OUTPUT_TOKENS,
    estimatedCostUsd: estimateCostUsd(estimatedInputTokens, ESTIMATED_OUTPUT_TOKENS),
    estimatedMaxCostUsd: estimateCostUsd(estimatedInputTokens, MAX_TOKENS),
  };
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

/** Real token usage + cost for a call that reached the model. Attached to
 *  errors thrown AFTER the Opus response arrives (a rejected or unparseable
 *  draft still cost money), so the pipeline/CLI can report the actual cost and
 *  count it toward the run budget — spend doesn't vanish just because the
 *  draft was thrown away. Absent when the API call itself never returned. */
export type UsageCost = {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

export class GenerationError extends Error {
  /** Present when the failure happened AFTER a billed response (e.g. no text
   *  block, unparseable JSON); absent when the request never returned. */
  constructor(message: string, public usage?: UsageCost) {
    super(message);
  }
}

/** Thrown when the generated draft fails validation/rejection — distinct from
 *  GenerationError (an API/infra failure) so the pipeline can save a
 *  'rejected' row with the specific reasons, instead of just logging a
 *  generic failure. Always carries usage: rejection only happens after a
 *  billed Opus response, so the cost is real and must be reported/counted. */
export class DraftRejectedError extends Error {
  constructor(public reasons: RejectReason[], public usage: UsageCost) {
    super(`Draft rejected: ${reasons.map((r) => r.code).join(", ")}`);
  }
}

/**
 * Deterministic post-processing, NOT a model call: Opus's own `sources`
 * output only asks for { id, type, title, url } (see schema.ts). The review
 * workspace's source panel needs richer bibliographic detail (journal, year,
 * PMID, DOI, abstract, provenance) — all of which the retrieval layer
 * already fetched and verified into `bundle` before Opus ever ran. Rather
 * than asking the model to restate facts it could get wrong, this looks
 * each cited source ID up in the original bundle and merges the real data
 * in. Zero extra tokens, zero hallucination risk.
 */
function enrichSources(sources: SourceCitation[], bundle: GeneSourceBundle): SourceCitation[] {
  const literatureById = new Map(bundle.literatureRecords.map((r) => [r.sourceId, r]));
  const trialById = new Map(bundle.trialRecords.map((r) => [r.sourceId, r]));

  return sources.map((s) => {
    const lit = literatureById.get(s.id);
    if (lit) {
      return {
        ...s,
        journal: lit.journal,
        year: lit.year,
        pmid: lit.pmid,
        doi: lit.doi,
        abstract: lit.abstract,
        provenance: lit.source,
      };
    }
    const trial = trialById.get(s.id);
    if (trial) {
      return {
        ...s,
        trialId: trial.nctId,
        abstract: trial.briefSummary,
        provenance: "clinicaltrials" as const,
      };
    }
    if (s.type === "ncbi-gene" || s.type === "rphope-resource" || s.type === "web") {
      return { ...s, provenance: s.type };
    }
    return s;
  });
}

/**
 * Generate one gene's draft page. Throws GenerationError on infra failure
 * (missing key, API error, unparseable response), or DraftRejectedError if
 * the draft fails validation (unknown source ID, schema validation failure).
 * The CLI catches both per-gene so one failure doesn't abort the whole run.
 */
export async function generateGenePage(
  bundle: GeneSourceBundle
): Promise<GenerationResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new GenerationError("ANTHROPIC_API_KEY is not set.");
  }

  const userPrompt = buildUserPrompt({
    geneSymbol: bundle.geneSymbol,
    evidenceTierBlock: buildEvidenceTierBlock(bundle.evidence),
    geneRecordJson: JSON.stringify(bundle.geneRecord, null, 2),
    literatureRecordsJson: JSON.stringify(bundle.literatureRecords, null, 2),
    clinicalTrialRecordsJson: JSON.stringify(bundle.trialRecords, null, 2),
    approvedGeneralResourcesJson: JSON.stringify(bundle.approvedResources, null, 2),
    webFallbackRecordsJson: JSON.stringify(bundle.webFallbackRecords, null, 2),
    unverifiedTrialReferencesJson: JSON.stringify(bundle.unverifiedTrialReferences, null, 2),
  });

  let message: Anthropic.Beta.Messages.BetaMessage;
  try {
    message = await client().beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: GENE_PAGE_SCHEMA },
      },
      system: [
        { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: userPrompt }],
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "unknown error";
    throw new GenerationError(`Opus request failed for ${bundle.geneSymbol}: ${detail}`);
  }

  // The response is billed the moment it arrives — capture usage NOW, before
  // any post-call check can throw, so a rejected/unparseable draft still
  // reports its real cost (and counts toward the run budget).
  const inputTokens = message.usage.input_tokens;
  const outputTokens = message.usage.output_tokens;
  const usage: UsageCost = {
    inputTokens,
    outputTokens,
    estimatedCostUsd: estimateCostUsd(inputTokens, outputTokens),
  };

  const textBlock = message.content.find(
    (b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text"
  );
  if (!textBlock) {
    throw new GenerationError(
      `No text content in Opus response for ${bundle.geneSymbol} (stop_reason: ${message.stop_reason}).`,
      usage
    );
  }

  let parsed: GenePageDraft;
  try {
    parsed = JSON.parse(textBlock.text) as GenePageDraft;
  } catch {
    throw new GenerationError(
      `Opus response for ${bundle.geneSymbol} was not valid JSON.`,
      usage
    );
  }

  // Defense in depth: never trust the model's self-reported governance status
  // or timestamp — these are set by the pipeline, not requested from Opus.
  parsed.reviewStatus = "unreviewed";
  parsed.generatedAt = new Date().toISOString();
  parsed = enforceLimits(parsed);
  parsed.sources = enrichSources(parsed.sources, bundle);

  const validation = validateDraft(parsed, bundle);
  if (!validation.ok) {
    throw new DraftRejectedError(validation.reasons, usage);
  }

  return {
    draft: parsed,
    inputTokens,
    outputTokens,
    estimatedCostUsd: usage.estimatedCostUsd,
  };
}
