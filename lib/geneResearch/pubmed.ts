// PubMed client — searches for a gene in the context of retinal disease, fetches
// abstracts, and hands them to rank.ts for scoring/dedup. Public E-utilities API,
// no key required (see ncbi.ts re: optional NCBI_API_KEY rate-limit bump).
//
// We run two search terms (gene + "retinitis pigmentosa", gene + "inherited
// retinal disease") to widen recall for rare genes, then dedup by PMID — this is
// what makes the "deduplicated" step meaningful rather than a no-op.
//
// Abstract text comes from efetch's PubMed XML. We extract just the fields we
// need (title, abstract, journal, year) with targeted regexes rather than a full
// XML parser — PubMed's export schema is stable and this keeps the dependency
// footprint at zero. Every generated page is human-reviewed before publish, so
// an occasional parsing miss surfaces as a thin/missing abstract, not a
// published error.

import type { PubMedRecord } from "./types";
import { scorePubMedRecord, rankAndDedupPubMed } from "./rank";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

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

async function esearchPmids(term: string, retmax: number): Promise<string[]> {
  const url = `${BASE}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(
    term
  )}&retmax=${retmax}&sort=relevance&retmode=json${apiKeyParam()}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as { esearchresult?: { idlist?: string[] } };
  return json.esearchresult?.idlist ?? [];
}

/** Parse PubMed efetch XML into lightweight per-article records. Exported for
 *  direct unit testing (no network) — see tests/gene-research-pubmed.test.ts. */
export function parseEfetchXml(xml: string): Omit<PubMedRecord, "sourceId" | "score">[] {
  const articles = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) ?? [];
  const out: Omit<PubMedRecord, "sourceId" | "score">[] = [];

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

    if (!title) continue;
    out.push({
      pmid,
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
): Promise<Omit<PubMedRecord, "sourceId" | "score">[]> {
  if (pmids.length === 0) return [];
  const url = `${BASE}/efetch.fcgi?db=pubmed&id=${pmids.join(
    ","
  )}&rettype=abstract&retmode=xml${apiKeyParam()}`;
  const res = await fetch(url, { headers: { accept: "application/xml" } });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseEfetchXml(xml);
}

/**
 * Search PubMed for a gene in the context of retinal disease, fetch abstracts,
 * score, dedup, and rank. Never throws — returns [] on any failure so a
 * retrieval hiccup doesn't stop the whole gene's generation (surfaced instead
 * as a thin source set / reviewFlag).
 */
export async function fetchPubMedRecords(
  geneSymbol: string,
  limit = 20
): Promise<PubMedRecord[]> {
  try {
    const [idsA, idsB] = await Promise.all([
      esearchPmids(`${geneSymbol}[tiab] AND "retinitis pigmentosa"[tiab]`, 20),
      esearchPmids(`${geneSymbol}[tiab] AND "inherited retinal disease"[tiab]`, 20),
    ]);
    const allIds = Array.from(new Set([...idsA, ...idsB]));
    if (allIds.length === 0) return [];

    const fetched = await efetchAbstracts(allIds);
    const scored: PubMedRecord[] = fetched.map((r) => ({
      ...r,
      sourceId: `pubmed:${r.pmid}`,
      score: scorePubMedRecord(r, geneSymbol),
    }));

    return rankAndDedupPubMed(scored, limit);
  } catch {
    return [];
  }
}
