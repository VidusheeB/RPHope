// The per-gene Opus call. One independent request per gene (never batched into
// a single prompt) so failures can be retried and reviewed separately, per the
// pipeline spec. Uses the beta Messages API for adaptive thinking + Structured
// Outputs (output_config), both newer than the stable v1 Messages surface —
// verified against the installed @anthropic-ai/sdk's beta type definitions
// before writing this, not assumed from memory.
//
// The system prompt is cached (cache_control: ephemeral) so running this across
// many genes only pays full input-token price once; subsequent genes hit the
// cache for that ~1,700-token block.

import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompts";
import { GENE_PAGE_SCHEMA } from "./schema";
import type { GeneSourceBundle, GenePageDraft, GenerationResult } from "./types";

const MODEL = "claude-opus-4-8";
const MAX_TOKENS = 12000;

// Standard pricing (not batch): $5/M input, $25/M output. Documented here so
// the CLI can print a running estimate; update if pricing changes.
const INPUT_PRICE_PER_M = 5;
const OUTPUT_PRICE_PER_M = 25;

export function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * INPUT_PRICE_PER_M +
    (outputTokens / 1_000_000) * OUTPUT_PRICE_PER_M
  );
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export class GenerationError extends Error {}

/**
 * Generate one gene's draft page. Throws GenerationError with a clear message
 * on any failure (missing key, API error, unparseable/invalid response) — the
 * CLI catches this per-gene so one failure doesn't abort the whole run.
 */
export async function generateGenePage(
  bundle: GeneSourceBundle
): Promise<GenerationResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new GenerationError("ANTHROPIC_API_KEY is not set.");
  }

  const userPrompt = buildUserPrompt({
    geneSymbol: bundle.geneSymbol,
    geneRecordJson: JSON.stringify(bundle.geneRecord ?? null, null, 2),
    existingApprovedPageJson: JSON.stringify(bundle.existingApprovedPage ?? null, null, 2),
    pubmedRecordsJson: JSON.stringify(bundle.pubmedRecords, null, 2),
    clinicalTrialRecordsJson: JSON.stringify(bundle.trialRecords, null, 2),
    approvedGeneralResourcesJson: JSON.stringify(bundle.approvedResources, null, 2),
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

  const textBlock = message.content.find(
    (b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text"
  );
  if (!textBlock) {
    throw new GenerationError(
      `No text content in Opus response for ${bundle.geneSymbol} (stop_reason: ${message.stop_reason}).`
    );
  }

  let parsed: GenePageDraft;
  try {
    parsed = JSON.parse(textBlock.text) as GenePageDraft;
  } catch {
    throw new GenerationError(
      `Opus response for ${bundle.geneSymbol} was not valid JSON.`
    );
  }

  // Defense in depth: never trust the model's self-reported governance status
  // or timestamp — these are set by the pipeline, not requested from Opus.
  parsed.reviewStatus = "unreviewed";
  parsed.generatedAt = new Date().toISOString();

  const inputTokens = message.usage.input_tokens;
  const outputTokens = message.usage.output_tokens;

  return {
    draft: parsed,
    inputTokens,
    outputTokens,
    estimatedCostUsd: estimateCostUsd(inputTokens, outputTokens),
  };
}
