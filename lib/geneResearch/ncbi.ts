// NCBI E-utilities client — verifies the human gene and fetches its record for
// a gene symbol. Public API, no key required (an optional NCBI_API_KEY raises
// the rate limit from 3 to 10 req/sec — see .env.example).
//
// Flow: esearch (db=gene, term="<SYMBOL>[sym] AND Homo sapiens[orgn]") to find
// the Gene ID, then esummary (db=gene) for the structured record. We request
// only the fields the prompt needs; nothing here is AI-generated.
//
// Returns a GeneVerificationResult, NOT a plain nullable record — the pipeline
// must be able to tell "gene doesn't exist" apart from "the NCBI request
// itself failed" (rate limit, network, malformed response). Both reject the
// gene from generation, but for different, clearly-logged reasons — a silent
// catch-all here previously made a real API failure indistinguishable from a
// legitimately nonexistent gene, which is exactly what this type prevents.

import type { GeneVerificationResult } from "./types";
import { ncbiFetch } from "./ncbiThrottle";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function apiKeyParam(): string {
  const key = process.env.NCBI_API_KEY;
  return key ? `&api_key=${encodeURIComponent(key)}` : "";
}

async function getJson(url: string): Promise<unknown> {
  const res = await ncbiFetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`NCBI request failed: HTTP ${res.status}`);
  return res.json();
}

/** Verify a human gene symbol against NCBI Gene and fetch its record. */
export async function fetchNcbiGeneRecord(
  symbol: string
): Promise<GeneVerificationResult> {
  try {
    const term = encodeURIComponent(`${symbol}[sym] AND Homo sapiens[orgn]`);
    const searchUrl = `${BASE}/esearch.fcgi?db=gene&term=${term}&retmode=json${apiKeyParam()}`;
    const search = (await getJson(searchUrl)) as {
      esearchresult?: { idlist?: string[] };
    };
    const geneId = search.esearchresult?.idlist?.[0];
    if (!geneId) {
      return { ok: true, record: null };
    }

    const summaryUrl = `${BASE}/esummary.fcgi?db=gene&id=${geneId}&retmode=json${apiKeyParam()}`;
    const summary = (await getJson(summaryUrl)) as {
      result?: Record<string, unknown>;
    };
    const rec = summary.result?.[geneId] as
      | {
          name?: string;
          description?: string;
          summary?: string;
          chromosome?: string;
          otheraliases?: string;
        }
      | undefined;
    if (!rec) {
      return { ok: true, record: null };
    }

    return {
      ok: true,
      record: {
        sourceId: `ncbi-gene:${geneId}`,
        geneId,
        symbol: rec.name || symbol,
        officialFullName: rec.description || undefined,
        summary: rec.summary || undefined,
        chromosome: rec.chromosome || undefined,
        aliases: (rec.otheraliases || "")
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`  [ncbi] gene lookup failed for ${symbol}: ${message}`);
    return { ok: false, error: message };
  }
}
