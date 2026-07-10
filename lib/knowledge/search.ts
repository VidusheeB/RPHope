// Hybrid keyword / phrase / prefix / fuzzy retrieval over the reviewed RP Hope
// knowledge records, using MiniSearch. Ranking boosts page titles, headings,
// gene symbols, keyword matches, clinical-trial identifiers, and matches on the
// page the user is currently viewing. Runs client-side (in-memory index built
// from bundled content) and server-side (rp-expert), so no DB or API key.

import MiniSearch from "minisearch";
import { KNOWLEDGE_RECORDS, type KnowledgeRecord } from "./records";
import { expandQuery } from "./synonyms";

export type SearchResult = {
  id: string;
  url: string;
  title: string;
  heading: string;
  snippet: string;
  contentType: KnowledgeRecord["contentType"];
  score: number;
};

export type SearchOptions = {
  limit?: number;
  /** Boost records that live on the page the user is currently viewing. */
  currentUrl?: string;
};

// Build the index once at module load.
const index = new MiniSearch<KnowledgeRecord>({
  fields: ["pageTitle", "heading", "text", "keywords"],
  storeFields: ["url", "pageTitle", "heading", "text", "contentType"],
  // keywords is an array — join it so MiniSearch can tokenize it.
  extractField: (doc, field) => {
    const v = doc[field as keyof KnowledgeRecord];
    return Array.isArray(v) ? v.join(" ") : ((v as string) ?? "");
  },
  searchOptions: {
    boost: { keywords: 3, heading: 2.5, pageTitle: 2, text: 1 },
    prefix: true,
    fuzzy: 0.2,
  },
});
index.addAll(KNOWLEDGE_RECORDS);

const recordsById = new Map(KNOWLEDGE_RECORDS.map((r) => [r.id, r]));

// Gene symbol / clinical-trial id lookups for exact-match promotion.
// e.g. "RPGR" -> gene:rpgr ; "NCT01234567" handled via keyword match.
const geneRecordBySymbol = new Map<string, KnowledgeRecord>();
for (const r of KNOWLEDGE_RECORDS) {
  if (r.contentType === "gene") geneRecordBySymbol.set(r.heading.toUpperCase(), r);
}

function toResult(r: KnowledgeRecord, score: number): SearchResult {
  const clean = r.text.replace(/\s+/g, " ").trim();
  return {
    id: r.id,
    url: r.url,
    title: r.pageTitle,
    heading: r.heading,
    snippet: clean.length > 240 ? clean.slice(0, 240).trimEnd() + "…" : clean,
    contentType: r.contentType,
    score,
  };
}

/**
 * Search the reviewed RP Hope knowledge base. Always returns reviewed content
 * only (the index is pre-filtered). Exact gene-symbol matches are promoted to
 * the top so "tell me about RPGR" reliably surfaces the RPGR page.
 */
export function searchKnowledge(
  query: string,
  opts: SearchOptions = {}
): SearchResult[] {
  const { limit = 5, currentUrl } = opts;
  const q = query.trim();
  if (!q) return [];

  const results = index.search(expandQuery(q), {
    boostDocument: (_id, _term, stored) => {
      // Boost anything on the page the user is currently viewing.
      return currentUrl && stored?.url === currentUrl ? 1.6 : 1;
    },
  });

  const out: SearchResult[] = [];
  const seen = new Set<string>();

  // 1) Promote exact gene-symbol / trial-id matches found in the raw query.
  for (const token of q.toUpperCase().match(/\b(NCT\d{6,}|[A-Z][A-Z0-9]{1,})\b/g) ?? []) {
    const gene = geneRecordBySymbol.get(token);
    if (gene && !seen.has(gene.id)) {
      out.push(toResult(gene, 1000));
      seen.add(gene.id);
    }
  }

  // 2) Then the ranked search results.
  for (const hit of results) {
    if (seen.has(hit.id)) continue;
    const rec = recordsById.get(hit.id as string);
    if (!rec) continue;
    out.push(toResult(rec, hit.score));
    seen.add(rec.id);
    if (out.length >= limit) break;
  }

  return out.slice(0, limit);
}
