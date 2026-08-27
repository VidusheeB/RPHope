// Europe PMC REST API client — high-recall retrieval design (matches
// pubmed.ts): broad gene search (symbol/aliases/full name, no retinal
// keyword required) + focused retinal search (same terms AND retinal
// vocabulary), each retrieving up to 100 candidates. Public API, no key
// required. Europe PMC indexes MEDLINE (the same records PubMed has) plus
// preprints and some non-MEDLINE journals, so it both corroborates PubMed
// hits (useful for dedup/confidence — merged via rank.ts's foundBy tracking)
// and can surface records PubMed's index missed. Unlike PubMed, a single
// search call with resultType=core returns the abstract directly — no
// separate efetch step.

import type { LiteratureRecord, FoundBy } from "./types";
import { classifyEvidence, scoreLiteratureRecord } from "./rank";
import { RETINAL_VOCABULARY } from "./pubmed";
import { fetchWithRetry } from "./fetchRetry";

const BASE = "https://www.ebi.ac.uk/europepmc/webservices/rest/search";
const RETRIEVAL_LIMIT = 100;

type EuropePmcResult = {
  id?: string;
  source?: string;
  pmid?: string;
  doi?: string;
  title?: string;
  abstractText?: string;
  journalTitle?: string;
  pubYear?: string;
};

function termGroup(terms: string[]): string {
  return `(${terms
    .map((t) => `TITLE:"${t}" OR ABSTRACT:"${t}"`)
    .join(" OR ")})`;
}

export function buildBroadQuery(terms: string[]): string {
  return termGroup(terms);
}

export function buildFocusedQuery(terms: string[]): string {
  return `${termGroup(terms)} AND ${termGroup(RETINAL_VOCABULARY)}`;
}

function findMatchedTerm(text: string, terms: string[]): string | undefined {
  const lower = text.toLowerCase();
  for (const term of terms) {
    if (lower.includes(term.toLowerCase())) return term;
  }
  return undefined;
}

async function search(
  query: string
): Promise<{ ok: true; results: EuropePmcResult[] } | { ok: false; error: string }> {
  const url = `${BASE}?query=${encodeURIComponent(
    query
  )}&format=json&resultType=core&pageSize=${RETRIEVAL_LIMIT}`;
  try {
    // Required retrieval: a transient blip here rejects the whole gene, so
    // retry before giving up. See fetchRetry.ts.
    const res = await fetchWithRetry(
      url,
      { headers: { accept: "application/json" } },
      { onRetry: (n, why) => console.warn(`  [europepmc] retry ${n} after ${why}`) }
    );
    if (!res.ok) {
      const detail = `HTTP ${res.status}`;
      console.warn(`  [europepmc] search failed: ${detail}`);
      return { ok: false, error: detail };
    }
    const json = (await res.json()) as { resultList?: { result?: EuropePmcResult[] } };
    return { ok: true, results: json.resultList?.result ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`  [europepmc] fetch failed: ${message}`);
    return { ok: false, error: message };
  }
}

export type EuropePmcRetrievalResult =
  | { ok: true; records: LiteratureRecord[] }
  | { ok: false; error: string };

/**
 * Run Europe PMC's broad + focused searches for a gene, producing
 * LiteratureRecord candidates with retrieval provenance. Does NOT rank,
 * dedupe, or cap — see rank.ts, applied after merging with PubMed + ELink.
 */
export async function fetchEuropePmcRecords(
  geneSymbol: string,
  searchTerms: string[]
): Promise<EuropePmcRetrievalResult> {
  const broadQuery = buildBroadQuery(searchTerms);
  const focusedQuery = buildFocusedQuery(searchTerms);

  const broad = await search(broadQuery);
  if (!broad.ok) return { ok: false, error: `broad search: ${broad.error}` };

  const focused = await search(focusedQuery);
  if (!focused.ok) return { ok: false, error: `focused search: ${focused.error}` };

  const byId = new Map<string, { result: EuropePmcResult; foundBy: FoundBy[] }>();
  for (const r of broad.results) {
    if (!r.id) continue;
    const entry = byId.get(r.id) ?? { result: r, foundBy: [] };
    entry.foundBy.push("europepmc-broad");
    byId.set(r.id, entry);
  }
  for (const r of focused.results) {
    if (!r.id) continue;
    const entry = byId.get(r.id) ?? { result: r, foundBy: [] };
    entry.foundBy.push("europepmc-focused");
    byId.set(r.id, entry);
  }

  const records: LiteratureRecord[] = Array.from(byId.values())
    .filter(({ result }) => result.title && (result.abstractText || result.pmid))
    .map(({ result: r, foundBy }) => {
      const year = r.pubYear ? Number(r.pubYear) : undefined;
      const abstract = r.abstractText || "";
      const title = r.title || "";
      return {
        sourceId: `europepmc:${r.id}`,
        source: "europepmc" as const,
        pmid: r.pmid || undefined,
        doi: r.doi || undefined,
        title,
        abstract,
        journal: r.journalTitle || undefined,
        year,
        url: r.doi
          ? `https://doi.org/${r.doi}`
          : `https://europepmc.org/article/${r.source || "MED"}/${r.id}`,
        evidenceCategory: classifyEvidence(title, abstract),
        score: scoreLiteratureRecord({ title, abstract, year }, geneSymbol),
        foundBy,
        matchedTerm: findMatchedTerm(`${title} ${abstract}`, searchTerms),
      };
    });

  return { ok: true, records };
}
