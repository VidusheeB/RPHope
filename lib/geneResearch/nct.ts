// Extract ClinicalTrials.gov NCT identifiers referenced in the text of selected
// literature, so a trial a publication names but the gene-name CT.gov search
// missed (LCA5's NCT05616793 was exactly this) can be fetched DIRECTLY by its
// ID and verified against the registry — never invented from the paper's prose.
//
// A valid NCT ID is the literal "NCT" followed by exactly 8 digits. The word
// boundaries reject malformed near-misses (too few / too many digits) rather
// than matching a truncated substring of them.

const NCT_RE = /\bNCT\d{8}\b/gi;

/** Every unique, normalized (upper-case) NCT ID appearing in `text`. */
export function extractNctIds(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const m of Array.from(text.matchAll(NCT_RE))) {
    found.add(m[0].toUpperCase());
  }
  return Array.from(found);
}

/** A literature record scanned for NCT references. */
export type NctSource = {
  sourceId: string;
  title?: string;
  abstract?: string;
};

/**
 * Scan a set of literature records for NCT IDs, returning each unique NCT ID
 * mapped to the source IDs of the publication(s) that referenced it — the
 * "which publication mentioned this trial" provenance the spec requires.
 */
export function collectNctReferences(
  records: NctSource[]
): { nctId: string; referencedBySourceIds: string[] }[] {
  const byNct = new Map<string, Set<string>>();
  for (const r of records) {
    const ids = extractNctIds(`${r.title ?? ""} ${r.abstract ?? ""}`);
    for (const nctId of ids) {
      const set = byNct.get(nctId) ?? new Set<string>();
      set.add(r.sourceId);
      byNct.set(nctId, set);
    }
  }
  return Array.from(byNct.entries()).map(([nctId, set]) => ({
    nctId,
    referencedBySourceIds: Array.from(set),
  }));
}
