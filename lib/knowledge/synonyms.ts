// RP-specific synonym map for the knowledge search. Expands a user's phrasing
// to the vocabulary the site actually uses, WITHOUT altering medical meaning
// (we never map, say, "cure" to "treatment"). Used by lib/knowledge/search.ts.

// Each key maps to additional terms that mean the same thing in this domain.
// Expansion is additive: the original query terms are always kept.
export const SYNONYMS: Record<string, string[]> = {
  rp: ["retinitis", "pigmentosa"],
  "retinitis pigmentosa": ["rp"],
  gene: ["genetic", "mutation", "variant"],
  "genetic test": ["genetic testing"],
  "gene test": ["genetic testing"],
  "genetic testing": ["genetic test", "gene panel", "sequencing"],
  study: ["clinical trial", "trial"],
  studies: ["clinical trial", "trial"],
  trial: ["clinical trial", "study"],
  trials: ["clinical trial", "study"],
  "clinical trial": ["trial", "study", "clinicaltrials"],
  "low vision": ["visual impairment", "vision loss", "sight loss"],
  blindness: ["vision loss", "visual impairment"],
  "night blindness": ["nyctalopia", "night vision"],
  "tunnel vision": ["peripheral vision loss", "visual field"],
  doctor: ["ophthalmologist", "retinal specialist", "genetic counselor", "clinician"],
  therapy: ["treatment", "gene therapy"],
  "gene therapy": ["gene replacement", "aav", "viral vector"],
  inheritance: ["inherited", "autosomal", "x-linked", "recessive", "dominant"],
  donate: ["donation", "give", "fundraise", "support"],
  event: ["events", "fundraiser", "webinar", "q&a"],
  story: ["stories", "patient story", "family story"],
  research: ["studies", "science", "findings"],
  news: ["updates", "articles", "recent research"],
};

// Common alternate spellings/abbreviations for whole tokens.
const TOKEN_ALIASES: Record<string, string> = {
  rp: "retinitis pigmentosa",
  ct: "clinical trial",
  gt: "gene therapy",
};

/**
 * Expand a raw query with domain synonyms. Returns the original query plus any
 * synonym terms appended, so MiniSearch matches both the user's words and the
 * site's vocabulary. Purely additive — never replaces or changes meaning.
 */
export function expandQuery(query: string): string {
  const lower = query.toLowerCase();
  const extras: string[] = [];

  // Phrase-level matches first (multi-word keys).
  for (const [key, values] of Object.entries(SYNONYMS)) {
    if (lower.includes(key)) extras.push(...values);
  }

  // Token-level aliases.
  for (const tok of lower.split(/[^a-z0-9&]+/).filter(Boolean)) {
    const alias = TOKEN_ALIASES[tok];
    if (alias) extras.push(alias);
  }

  const unique = Array.from(new Set(extras)).filter((t) => !lower.includes(t));
  return unique.length ? `${query} ${unique.join(" ")}` : query;
}
