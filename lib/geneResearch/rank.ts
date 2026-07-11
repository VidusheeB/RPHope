// Pure ranking + deduplication for PubMed records — no network calls, so this
// is fully unit-testable. Scores favor recency and topical relevance (gene
// symbol + retinal-disease terms appearing in title/abstract), matching the
// "ranked and deduplicated" input the generation prompt expects.

import type { PubMedRecord } from "./types";

const CURRENT_YEAR = new Date().getFullYear();

const RETINAL_TERMS = [
  "retinitis pigmentosa",
  "inherited retinal",
  "retinal degeneration",
  "retinal dystrophy",
  "photoreceptor",
  "rod-cone",
  "cone-rod",
];

export function scorePubMedRecord(
  record: Pick<PubMedRecord, "title" | "abstract" | "year">,
  geneSymbol: string
): number {
  const haystack = `${record.title} ${record.abstract}`.toLowerCase();
  const symbol = geneSymbol.toLowerCase();
  let score = 0;

  // Gene symbol mentioned — strong topical signal.
  if (new RegExp(`\\b${symbol}\\b`, "i").test(haystack)) score += 5;

  // Retinal-disease vocabulary present.
  for (const term of RETINAL_TERMS) {
    if (haystack.includes(term)) score += 2;
  }

  // Recency bonus, capped so very old work isn't zeroed out entirely.
  if (record.year) {
    const age = CURRENT_YEAR - record.year;
    score += Math.max(0, 5 - Math.floor(age / 2));
  }

  return score;
}

/**
 * Deduplicate by PMID (keeping the first occurrence) and sort by score
 * descending, then by year descending as a tiebreaker. Caps to `limit`.
 */
export function rankAndDedupPubMed(
  records: PubMedRecord[],
  limit = 20
): PubMedRecord[] {
  const seen = new Set<string>();
  const deduped: PubMedRecord[] = [];
  for (const r of records) {
    if (seen.has(r.pmid)) continue;
    seen.add(r.pmid);
    deduped.push(r);
  }
  return deduped
    .sort((a, b) => b.score - a.score || (b.year ?? 0) - (a.year ?? 0))
    .slice(0, limit);
}
