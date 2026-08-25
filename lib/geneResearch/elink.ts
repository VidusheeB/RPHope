// NCBI ELink — retrieves PubMed IDs directly linked to a verified NCBI Gene ID
// via NCBI's own curated gene-to-publication associations (the "gene_pubmed"
// linkname), independent of any text search. This is a high-precision
// complement to the broad/focused PubMed text searches — a paper can be
// linked here even if it doesn't happen to match our search terms exactly.
// Public API, no key required (subject to the same NCBI rate limit as
// ncbi.ts/pubmed.ts — throttled via ncbiThrottle.ts).

import { ncbiFetch } from "./ncbiThrottle";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function apiKeyParam(): string {
  const key = process.env.NCBI_API_KEY;
  return key ? `&api_key=${encodeURIComponent(key)}` : "";
}

export type ElinkResult =
  | { ok: true; pmids: string[] }
  | { ok: false; error: string };

export async function fetchGeneToPubmedElink(geneId: string): Promise<ElinkResult> {
  const url = `${BASE}/elink.fcgi?dbfrom=gene&db=pubmed&id=${encodeURIComponent(
    geneId
  )}&retmode=json${apiKeyParam()}`;
  try {
    const res = await ncbiFetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      const detail = `elink HTTP ${res.status}`;
      console.warn(`  [elink] gene-to-pubmed lookup failed for gene ${geneId}: ${detail}`);
      return { ok: false, error: detail };
    }
    const json = (await res.json()) as {
      linksets?: { linksetdbs?: { linkname?: string; links?: string[] }[] }[];
    };
    const linksetdbs = json.linksets?.[0]?.linksetdbs ?? [];
    const geneToPubmed = linksetdbs.find((l) => l.linkname === "gene_pubmed");
    return { ok: true, pmids: geneToPubmed?.links ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`  [elink] gene-to-pubmed lookup failed for gene ${geneId}: ${message}`);
    return { ok: false, error: message };
  }
}
