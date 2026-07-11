// NCBI E-utilities client — fetches the verified NCBI Gene record for a human
// gene symbol. Public API, no key required (an optional NCBI_API_KEY raises the
// rate limit from 3 to 10 req/sec — see .env.example).
//
// Flow: esearch (db=gene, term="<SYMBOL>[sym] AND Homo sapiens[orgn]") to find
// the Gene ID, then esummary (db=gene) for the structured record. We request
// only the fields the prompt needs; nothing here is AI-generated.

import type { NcbiGeneRecord } from "./types";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function apiKeyParam(): string {
  const key = process.env.NCBI_API_KEY;
  return key ? `&api_key=${encodeURIComponent(key)}` : "";
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`NCBI request failed: ${res.status}`);
  return res.json();
}

/**
 * Look up the verified NCBI Gene record for a human gene symbol. Returns null
 * (never throws) if the gene isn't found or the API is unreachable — the
 * pipeline treats a missing NCBI record as a reviewFlag, not a hard failure.
 */
export async function fetchNcbiGeneRecord(
  symbol: string
): Promise<NcbiGeneRecord | null> {
  try {
    const term = encodeURIComponent(`${symbol}[sym] AND Homo sapiens[orgn]`);
    const searchUrl = `${BASE}/esearch.fcgi?db=gene&term=${term}&retmode=json${apiKeyParam()}`;
    const search = (await getJson(searchUrl)) as {
      esearchresult?: { idlist?: string[] };
    };
    const geneId = search.esearchresult?.idlist?.[0];
    if (!geneId) return null;

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
    if (!rec) return null;

    return {
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
    };
  } catch {
    return null;
  }
}
