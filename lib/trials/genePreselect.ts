// Validate the gene-page CTA's `?gene=` URL parameter for the Clinical Trials
// Finder. Reuses the Finder's own deterministic gene normalization
// (normalizeGene) so a preselected gene is validated exactly like a typed one —
// there is no second source of truth for what counts as a known gene.

import { normalizeGene } from "./normalize";

/**
 * Resolve a `?gene=` parameter (typically a gene-page slug like "lca5") to a
 * canonical RP Hope gene display name (e.g. "LCA5"), or null when it is not a
 * known gene.
 *
 * Only an EXACT match (after case/punctuation normalization) preselects — a URL
 * should never silently pick a fuzzy "did you mean" gene the visitor didn't ask
 * for. Absent, blank, non-string, or unknown input all return null so the Finder
 * falls back to its default behavior. Never throws.
 */
export function resolvePreselectedGene(param?: string | null): string | null {
  if (typeof param !== "string") return null;
  const trimmed = param.trim();
  if (!trimmed) return null;
  try {
    const norm = normalizeGene(trimmed);
    return norm.status === "exact" && norm.normalized ? norm.normalized : null;
  } catch {
    return null;
  }
}
