// Literal content search over the site's real text — the floor under the AI
// navigation assistant. The assistant used to see only labels/titles, so a
// plain word ("ache", "night", "crispr") it couldn't map. This indexes the
// actual body text (gene plain-English summaries especially) so a literal
// keyword scan can surface where a word really appears. Results are then handed
// to the AI to rank + phrase. No external service — builds from local data, so
// it works with or without Supabase/keys, matching genesRepo's fallback design.

import { geneGrid } from "./geneGrid";
import genesData from "./genesData.json";
import articles from "./articlesIndex.json";
import { sections } from "./navTargets";

type GeneRecord = {
  gene: string;
  slug: string;
  diseaseCategory?: string;
  treatmentOptions?: string;
  summary?: string;
};

export type SearchDoc = {
  href: string;
  label: string;
  kind: "section" | "gene" | "article";
  /** Short human-readable line shown to the AI as context. */
  snippet: string;
  /** Lowercased label text, weighted highest in scoring. */
  labelText: string;
  /** Lowercased body text (summaries etc.), weighted lower. */
  bodyText: string;
};

// Words too common to be useful as a search signal.
const STOPWORDS = new Set([
  "the","a","an","and","or","of","to","in","on","for","with","is","are","was",
  "i","my","me","we","you","your","it","this","that","at","by","be","as","do",
  "where","what","which","how","who","can","could","about","into","from","find",
  "show","tell","looking","look","page","gene","rp","please","help","need",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function firstSentence(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const dot = clean.indexOf(". ");
  const cut = dot > 30 && dot < max ? dot + 1 : max;
  return clean.length > cut ? clean.slice(0, cut).trim() + "…" : clean;
}

// Build the index once at module load.
const genesBySlug = new Map<string, GeneRecord>(
  (genesData as GeneRecord[]).map((g) => [g.slug, g])
);

export const searchDocs: SearchDoc[] = [
  ...sections.map((s): SearchDoc => ({
    href: s.href,
    label: s.label,
    kind: "section",
    snippet: s.about,
    labelText: s.label.toLowerCase(),
    bodyText: s.about.toLowerCase(),
  })),
  ...geneGrid.map((g): SearchDoc => {
    const rec = genesBySlug.get(g.slug);
    const summary = rec?.summary ?? "";
    const body = [g.label, rec?.diseaseCategory, rec?.treatmentOptions, summary]
      .filter(Boolean)
      .join(" ");
    return {
      href: `/genetic-insights/${g.slug}`,
      label: `${g.display} (gene)`,
      kind: "gene",
      snippet: summary ? firstSentence(summary) : `${g.display} gene page (${g.label})`,
      labelText: g.display.toLowerCase(),
      bodyText: body.toLowerCase(),
    };
  }),
  ...(articles as { title: string; url: string }[]).map((a): SearchDoc => ({
    href: a.url,
    label: a.title,
    kind: "article",
    snippet: a.title,
    labelText: a.title.toLowerCase(),
    bodyText: a.title.toLowerCase(),
  })),
];

export type ScoredDoc = SearchDoc & { score: number };

/**
 * Literal keyword search over real page text. Token-based (so "ache" does not
 * match "headache"), with a whole-query phrase bonus. Returns the best matches,
 * highest score first; empty array when nothing matches.
 */
export function searchContent(query: string, limit = 12): ScoredDoc[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const phrase = query.toLowerCase().trim();

  const scored: ScoredDoc[] = [];
  for (const doc of searchDocs) {
    const labelWords = new Set(tokenize(doc.labelText));
    const bodyWords = new Set(tokenize(doc.bodyText));
    let score = 0;

    for (const t of tokens) {
      if (labelWords.has(t)) score += 6;
      else if (bodyWords.has(t)) score += 3;
      else if (t.length >= 4 && doc.bodyText.includes(t)) score += 1; // partial typing
    }
    // Whole multi-word phrase appearing verbatim is a strong signal.
    if (phrase.length > 4 && phrase.includes(" ") && doc.bodyText.includes(phrase)) {
      score += 4;
    }

    if (score > 0) scored.push({ ...doc, score });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
