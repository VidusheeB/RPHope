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

/** How many esearch hits to check for an exact symbol match. A "[sym]" query
 *  should return one gene, but it demonstrably does not always put the right
 *  one first, so we look past the head of the list before giving up. */
const MAX_CANDIDATE_IDS = 5;

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
    const idList = (search.esearchresult?.idlist ?? []).slice(0, MAX_CANDIDATE_IDS);
    if (!idList.length) {
      return { ok: true, record: null };
    }

    // Fetch every candidate, not just the first. esearch's ordering is NOT a
    // relevance guarantee: a "[sym]" query for INPP5E returned PMPCA first, and
    // because the old code took idlist[0] and then relabelled itself with
    // whatever came back (`rec.name || symbol`), the pipeline silently built an
    // INPP5E page out of a different gene's record. One comma-separated
    // esummary keeps this to a single extra-free request.
    const summaryUrl = `${BASE}/esummary.fcgi?db=gene&id=${idList.join(",")}&retmode=json${apiKeyParam()}`;
    const summary = (await getJson(summaryUrl)) as {
      result?: Record<string, unknown>;
    };

    type SummaryRec = {
      name?: string;
      description?: string;
      summary?: string;
      chromosome?: string;
      otheraliases?: string;
    };

    // Accept ONLY a record whose official symbol is the one we asked for.
    // Anything else is a different gene, and publishing it under this gene's
    // slug would be worse than having no page at all.
    const wanted = symbol.trim().toUpperCase();
    let geneId: string | undefined;
    let rec: SummaryRec | undefined;
    for (const id of idList) {
      const candidate = summary.result?.[id] as SummaryRec | undefined;
      if (!candidate) continue;
      if ((candidate.name ?? "").trim().toUpperCase() === wanted) {
        geneId = id;
        rec = candidate;
        break;
      }
    }

    if (!geneId || !rec) {
      const got = idList
        .map((id) => (summary.result?.[id] as SummaryRec | undefined)?.name)
        .filter(Boolean)
        .join(", ");
      console.warn(
        `  [ncbi] no exact symbol match for ${symbol}` +
          (got ? ` (NCBI returned: ${got})` : "") +
          " — refusing to use a different gene's record"
      );
      return { ok: true, record: null };
    }

    return {
      ok: true,
      record: {
        sourceId: `ncbi-gene:${geneId}`,
        geneId,
        // rec.name is now guaranteed to equal the requested symbol.
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
