// Web-search fallback — NOT part of the main generation call (see
// generate.ts's header comment: no second model-synthesis stage). This is a
// separate, narrow RETRIEVAL step: it searches and fetches, it does not
// draft. Used only when the deterministic evidence bundle (NCBI + PubMed +
// Europe PMC + ClinicalTrials.gov) is thin.
//
// Scope, per the retrieval spec (requirement #10): this fills gaps the
// structured databases can't — current FDA actions, trial-status changes, or
// university/company announcements — NOT a general journal-discovery
// substitute for PubMed/Europe PMC. The prompt says so explicitly.
//
// Every result must carry real retrieved page text (requirement #11: "A
// title and URL alone are insufficient evidence"). The model must call
// web_fetch on each candidate URL and copy a genuine excerpt into `snippet`
// — a result with no real fetched text is dropped, never included with a
// placeholder. Both web_search and web_fetch are restricted to the approved
// domain allowlist AT THE TOOL LEVEL (`allowed_domains`), and the result is
// filtered again in code afterward — a model instruction or a single
// tool-level guarantee is not trusted alone.

import Anthropic from "@anthropic-ai/sdk";
import type { WebSearchRecord } from "./types";
import { APPROVED_WEB_DOMAINS, isApprovedDomain } from "./webSearchAllowlist";

const MODEL = "claude-opus-4-8";
const MAX_SEARCHES = 3;
const MAX_FETCHES = 5;
const MAX_CONTENT_TOKENS_PER_FETCH = 3000;
const MAX_TOKENS = 3000;
// Below this, a "snippet" is more likely a restated title than real fetched
// text — reject rather than trust it.
const MIN_SNIPPET_LENGTH = 30;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

/** Evidence-bundle thinness threshold that triggers the fallback. Combined
 *  literature + trial record count, post-dedup/selection. Deliberately
 *  small — this is a gap-filler for genes the structured databases found
 *  little on, not a routine step. */
export const THIN_EVIDENCE_THRESHOLD = 3;

export function isEvidenceThin(literatureCount: number, trialCount: number): boolean {
  return literatureCount + trialCount < THIN_EVIDENCE_THRESHOLD;
}

function buildPrompt(geneSymbol: string): string {
  return `The structured databases (NCBI Gene, PubMed, Europe PMC, ClinicalTrials.gov) returned little evidence for the gene ${geneSymbol} in the context of retinitis pigmentosa or inherited retinal disease.

Search ONLY for evidence those databases would not already contain: current FDA actions, clinical-trial status changes, or university/company announcements about ${geneSymbol} and retinal disease. Do NOT use this search to look for peer-reviewed journal articles or research papers in general — that is PubMed's and Europe PMC's job, not yours. If you find nothing beyond ordinary journal literature, return no results.

You may search and fetch ONLY these domains: ${APPROVED_WEB_DOMAINS.join(", ")}. Ignore any result from a domain not on this list.

For every candidate you consider including, you MUST call web_fetch on its URL and read the real page content. Then copy a short, genuine excerpt (one to three sentences, copied from the fetched text, not paraphrased or invented) into that result's "snippet". Never write a snippet from a title or search-result description alone — if you cannot successfully fetch a candidate's page, drop it.

When you are done, respond with ONLY a JSON array (no markdown fences, no other text) of the results you are including, in this exact shape:
[{"title": "...", "url": "...", "snippet": "..."}]

If there is nothing to include, respond with exactly: []`;
}

/**
 * Run a bounded, domain-restricted web search + fetch to fill an identified
 * evidence gap for one gene. Returns [] (never throws) on any failure — this
 * is a best-effort supplement, not a required source; the pipeline's
 * "required retrieval failed" reject condition does not apply to this step.
 */
export async function fetchWebSearchFallback(
  geneSymbol: string
): Promise<WebSearchRecord[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  try {
    const tools = [
      {
        type: "web_search_20260209",
        name: "web_search",
        max_uses: MAX_SEARCHES,
        allowed_domains: [...APPROVED_WEB_DOMAINS],
      },
      {
        type: "web_fetch_20260209",
        name: "web_fetch",
        max_uses: MAX_FETCHES,
        allowed_domains: [...APPROVED_WEB_DOMAINS],
        max_content_tokens: MAX_CONTENT_TOKENS_PER_FETCH,
      },
    ] as unknown as Anthropic.Beta.Messages.BetaToolUnion[];

    const message = await client().beta.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      tools,
      messages: [{ role: "user", content: buildPrompt(geneSymbol) }],
    });

    const textBlock = message.content.find(
      (b): b is Anthropic.Beta.Messages.BetaTextBlock => b.type === "text"
    );
    if (!textBlock) return [];

    const raw = textBlock.text.trim();
    if (raw === "" || raw === "[]") return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn(
        `  [web-fallback] non-JSON response for ${geneSymbol}, discarding: ${raw.slice(0, 200)}`
      );
      return [];
    }
    if (!Array.isArray(parsed)) return [];

    const records: WebSearchRecord[] = [];
    let n = 0;
    for (const item of parsed) {
      if (
        !item ||
        typeof item !== "object" ||
        typeof (item as Record<string, unknown>).title !== "string" ||
        typeof (item as Record<string, unknown>).url !== "string" ||
        typeof (item as Record<string, unknown>).snippet !== "string"
      ) {
        continue;
      }
      const { title, url, snippet } = item as { title: string; url: string; snippet: string };

      if (!isApprovedDomain(url)) {
        console.warn(`  [web-fallback] dropping non-allowlisted URL: ${url}`);
        continue;
      }
      if (snippet.trim().length < MIN_SNIPPET_LENGTH) {
        console.warn(`  [web-fallback] dropping result with no real captured text: ${url}`);
        continue;
      }

      n += 1;
      records.push({
        sourceId: `web:${n}`,
        title: title.trim(),
        url: url.trim(),
        domain: new URL(url).hostname.replace(/^www\./, ""),
        snippet: snippet.trim(),
      });
    }
    return records;
  } catch (err) {
    console.warn(
      `  [web-fallback] search failed for ${geneSymbol}: ${err instanceof Error ? err.message : err}`
    );
    return [];
  }
}
