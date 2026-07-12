// Filters NCBI's raw gene aliases down to "safe" search terms — ones specific
// enough to use in a broad, no-retinal-keyword-required PubMed/Europe PMC
// query without flooding results with unrelated hits. Per the retrieval spec:
// "Exclude aliases that are generic words or likely to produce severe
// ambiguity unless combined with a retinal context."
//
// This is a heuristic, not a perfect classifier — it errs toward excluding a
// borderline alias rather than risking a noisy broad search, since the
// focused (retinal-context) search still covers ambiguous aliases safely.

// Common English words / short strings that show up as gene aliases but are
// far too generic to search broadly on their own (e.g. "CAT", "SET", "REST").
// Kept short and conservative — this is a targeted stoplist, not a full
// dictionary.
const GENERIC_WORDS = new Set([
  "cat", "set", "rest", "was", "for", "not", "his", "her", "one", "two",
  "act", "arc", "art", "bad", "bar", "bat", "bud", "can", "car", "cop",
  "cut", "day", "eye", "fat", "fit", "gap", "gas", "hit", "hot", "ice",
  "jam", "key", "lap", "leg", "lot", "map", "mix", "net", "new", "old",
  "out", "pad", "pan", "pen", "pit", "pod", "pop", "pot", "pump", "ram",
  "raw", "red", "rip", "rod", "run", "sad", "saw", "sea", "sec", "sex",
  "sky", "son", "sun", "tap", "tax", "tea", "top", "toy", "try", "van",
  "war", "wax", "way", "web", "win", "yes", "you", "all", "and", "are",
  "man", "may", "who", "why",
]);

function isSafeAlias(alias: string): boolean {
  const a = alias.trim();
  if (a.length < 3) return false; // too short — near-guaranteed false positives
  if (/^\d+$/.test(a)) return false; // purely numeric
  if (GENERIC_WORDS.has(a.toLowerCase())) return false;
  // Aliases that are themselves common English words when lowercased render
  // ambiguously in a title/abstract search even at length >= 3 (e.g. "SAG",
  // "REST" already covered above at len<3/stoplist; catch a few more 3-4
  // letter common words not already listed).
  return true;
}

/** Official symbol + official full name + safe aliases — the term set used to
 *  build BOTH the broad and focused PubMed/Europe PMC queries. Deduplicated,
 *  order-preserving (symbol first). */
export function getSearchTerms(record: {
  symbol: string;
  officialFullName?: string;
  aliases: string[];
}): { allTerms: string[]; safeAliases: string[]; excludedAliases: string[] } {
  const safeAliases: string[] = [];
  const excludedAliases: string[] = [];
  for (const alias of record.aliases) {
    if (!alias || alias === record.symbol) continue;
    (isSafeAlias(alias) ? safeAliases : excludedAliases).push(alias);
  }

  const terms = [record.symbol, ...safeAliases];
  if (record.officialFullName) terms.push(record.officialFullName);

  return {
    allTerms: Array.from(new Set(terms)),
    safeAliases,
    excludedAliases,
  };
}
