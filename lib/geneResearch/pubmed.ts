// PubMed client — high-recall retrieval design (retrieval spec, 2026-07-12):
//   A. Broad gene search: official symbol OR safe aliases OR full name in
//      Title/Abstract. No retinal keyword required.
//   B. Focused retinal search: the same term set AND a broad retinal
//      vocabulary (retina, photoreceptor, dystrophy, RP, LCA, ciliopathy...).
// Each query retrieves up to 100 candidates (not capped at 20) — ranking, not
// the query itself, is what narrows the field down (see rank.ts). This
// replaces the earlier narrower "gene AND disease-phrase" design, which
// silently missed genes described by a different disease name (e.g. LCA5,
// whose literature says "Leber congenital amaurosis," not
// "retinitis pigmentosa").
//
// Abstract text + DOI come from efetch's PubMed XML, batched to keep request
// URLs a reasonable size. We extract fields with targeted regexes rather than
// a full XML parser — PubMed's export schema is stable and this keeps the
// dependency footprint at zero.
//
// `matchedTerm` (which gene term actually appears in the title/abstract) is
// determined locally after fetching, by scanning the real text against the
// search term list — PubMed's esearch API doesn't report per-term match
// attribution for an OR query, so re-deriving it from the fetched content is
// both accurate and avoids firing one API call per alias.

import type { LiteratureRecord, FoundBy } from "./types";
import { classifyEvidence, scoreLiteratureRecord } from "./rank";
import { throttleNcbi } from "./ncbiThrottle";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const RETRIEVAL_LIMIT = 100;
const EFETCH_BATCH_SIZE = 150;

export const RETINAL_VOCABULARY = [
  "retina", "retinal", "photoreceptor", "blindness", "dystrophy",
  "retinitis pigmentosa", "rod-cone", "cone-rod", "macular",
  "Leber congenital amaurosis", "early-onset severe retinal dystrophy",
  "ciliopathy", "night blindness", "nyctalopia", "inherited retinal disease",
];

function apiKeyParam(): string {
  const key = process.env.NCBI_API_KEY;
  return key ? `&api_key=${encodeURIComponent(key)}` : "";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " "));
}

/** Builds a PubMed [tiab] OR-group from a list of terms, quoting multi-word
 *  terms. Exported so the broad/focused query text is inspectable/testable. */
export function buildTermGroup(terms: string[]): string {
  return `(${terms.map((t) => (t.includes(" ") ? `"${t}"[tiab]` : `${t}[tiab]`)).join(" OR ")})`;
}

export function buildBroadQuery(terms: string[]): string {
  return buildTermGroup(terms);
}

export function buildFocusedQuery(terms: string[]): string {
  return `${buildTermGroup(terms)} AND ${buildTermGroup(RETINAL_VOCABULARY)}`;
}

type PubMedFetchResult =
  | { ok: true; ids: string[] }
  | { ok: false; error: string };

async function esearchPmids(term: string, retmax: number): Promise<PubMedFetchResult> {
  const url = `${BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(
    term
  )}&retmax=${retmax}&sort=relevance&retmode=json${apiKeyParam()}`;
  await throttleNcbi();
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    const detail = `esearch HTTP ${res.status}`;
    console.warn(`  [pubmed] ${detail} for term: ${term.slice(0, 120)}`);
    return { ok: false, error: detail };
  }
  const json = (await res.json()) as { esearchresult?: { idlist?: string[] } };
  return { ok: true, ids: json.esearchresult?.idlist ?? [] };
}

type ParsedArticle = {
  pmid: string;
  doi?: string;
  title: string;
  abstract: string;
  journal?: string;
  year?: number;
  url: string;
};

/** Parse PubMed efetch XML into lightweight per-article records, including
 *  DOI (needed for cross-source dedup against Europe PMC). Exported for
 *  direct unit testing (no network) — see tests/gene-research-pubmed.test.ts. */
export function parseEfetchXml(xml: string): ParsedArticle[] {
  const articles = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) ?? [];
  const out: ParsedArticle[] = [];

  for (const block of articles) {
    const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    const pmid = pmidMatch?.[1];
    if (!pmid) continue;

    const titleMatch = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/);
    const title = titleMatch ? stripTags(titleMatch[1]) : "";

    const abstractParts = Array.from(
      block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)
    ).map((m) => stripTags(m[1]));
    const abstract = abstractParts.join(" ");

    const journalMatch = block.match(/<Title>([\s\S]*?)<\/Title>/);
    const journal = journalMatch ? stripTags(journalMatch[1]) : undefined;

    const yearMatch =
      block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/) ||
      block.match(/<ArticleDate[^>]*>[\s\S]*?<Year>(\d{4})<\/Year>/);
    const year = yearMatch ? Number(yearMatch[1]) : undefined;

    const doiMatch = block.match(/<ELocationID EIdType="doi"[^>]*>([\s\S]*?)<\/ELocationID>/);
    const doi = doiMatch ? stripTags(doiMatch[1]) : undefined;

    if (!title) continue;
    out.push({
      pmid,
      doi,
      title,
      abstract,
      journal,
      year,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    });
  }
  return out;
}

async function efetchAbstracts(
  pmids: string[]
): Promise<{ ok: true; articles: ParsedArticle[] } | { ok: false; error: string }> {
  if (pmids.length === 0) return { ok: true, articles: [] };
  const batches: string[][] = [];
  for (let i = 0; i < pmids.length; i += EFETCH_BATCH_SIZE) {
    batches.push(pmids.slice(i, i + EFETCH_BATCH_SIZE));
  }

  const articles: ParsedArticle[] = [];
  for (const batch of batches) {
    const url = `${BASE}/efetch.fcgi?db=pubmed&id=${batch.join(
      ","
    )}&rettype=abstract&retmode=xml${apiKeyParam()}`;
    await throttleNcbi();
    const res = await fetch(url, { headers: { accept: "application/xml" } });
    if (!res.ok) {
      const detail = `efetch HTTP ${res.status}`;
      console.warn(`  [pubmed] ${detail} for ${batch.length} id(s)`);
      return { ok: false, error: detail };
    }
    const xml = await res.text();
    articles.push(...parseEfetchXml(xml));
  }
  return { ok: true, articles };
}

/** Which of the search terms actually appears in this record's text —
 *  determined locally since esearch doesn't report per-term OR attribution. */
function findMatchedTerm(text: string, terms: string[]): string | undefined {
  const lower = text.toLowerCase();
  for (const term of terms) {
    if (lower.includes(term.toLowerCase())) return term;
  }
  return undefined;
}

export type PubMedRetrievalResult =
  | { ok: true; records: LiteratureRecord[] }
  | { ok: false; error: string };

/**
 * Run PubMed's broad + focused searches for a gene (using its verified
 * symbol, safe aliases, and full name), fetch abstracts + DOIs for the union
 * of results, and produce LiteratureRecord candidates with full retrieval
 * provenance (foundBy, matchedTerm). Does NOT rank, dedupe, or cap — that is
 * rank.ts's job, applied after merging with Europe PMC + ELink results.
 *
 * The two esearch calls run SEQUENTIALLY (not Promise.all), and this
 * function itself runs after the NCBI gene lookup, not concurrently with it
 * — see ncbiThrottle.ts for why (a real, confirmed rate-limit bug).
 */
export async function fetchPubMedRecords(
  geneSymbol: string,
  searchTerms: string[]
): Promise<PubMedRetrievalResult> {
  const broadQuery = buildBroadQuery(searchTerms);
  const focusedQuery = buildFocusedQuery(searchTerms);

  const broadResult = await esearchPmids(broadQuery, RETRIEVAL_LIMIT);
  if (!broadResult.ok) return { ok: false, error: `broad search: ${broadResult.error}` };

  const focusedResult = await esearchPmids(focusedQuery, RETRIEVAL_LIMIT);
  if (!focusedResult.ok) return { ok: false, error: `focused search: ${focusedResult.error}` };

  const idToFoundBy = new Map<string, FoundBy[]>();
  for (const id of broadResult.ids) idToFoundBy.set(id, [...(idToFoundBy.get(id) ?? []), "pubmed-broad"]);
  for (const id of focusedResult.ids) idToFoundBy.set(id, [...(idToFoundBy.get(id) ?? []), "pubmed-focused"]);

  const allIds = Array.from(idToFoundBy.keys());
  if (allIds.length === 0) return { ok: true, records: [] };

  const fetched = await efetchAbstracts(allIds);
  if (!fetched.ok) return { ok: false, error: `efetch: ${fetched.error}` };

  const records: LiteratureRecord[] = fetched.articles.map((a) => {
    const foundBy = idToFoundBy.get(a.pmid) ?? [];
    const matchedTerm = findMatchedTerm(`${a.title} ${a.abstract}`, searchTerms);
    return {
      ...a,
      sourceId: `pubmed:${a.pmid}`,
      source: "pubmed" as const,
      evidenceCategory: classifyEvidence(a.title, a.abstract),
      score: scoreLiteratureRecord(a, geneSymbol),
      foundBy,
      matchedTerm,
    };
  });

  return { ok: true, records };
}

/**
 * Fetch abstracts for a set of PMIDs already known via ELink (Gene-to-PubMed
 * curated associations), tagging every result foundBy "pubmed-elink". No
 * text search involved, so matchedTerm is left undefined — an ELink find is
 * a curated association, not a term match.
 */
export async function fetchPubMedRecordsByPmid(
  pmids: string[],
  geneSymbol: string
): Promise<PubMedRetrievalResult> {
  if (pmids.length === 0) return { ok: true, records: [] };
  const fetched = await efetchAbstracts(pmids);
  if (!fetched.ok) return { ok: false, error: `efetch: ${fetched.error}` };

  const records: LiteratureRecord[] = fetched.articles.map((a) => ({
    ...a,
    sourceId: `pubmed:${a.pmid}`,
    source: "pubmed" as const,
    evidenceCategory: classifyEvidence(a.title, a.abstract),
    score: scoreLiteratureRecord(a, geneSymbol),
    foundBy: ["pubmed-elink"] as FoundBy[],
    matchedTerm: undefined,
  }));

  return { ok: true, records };
}
