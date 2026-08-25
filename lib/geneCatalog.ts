// The authoritative RP Hope gene list, from RP_Hope_genes_to_include_94.xlsx
// (compiled 22 August 2026).
//
// THE INCLUSION RULE (from the sheet's README): a gene is included if someone
// diagnosed with RP could get that gene back on a genetic test. That is the
// only test applied.
//
// 94 genes come from the sheet's "Genes to include" tab. BEST2 and ENSA are
// carried here as a deliberate 95th/96th: the sheet moved both to "Do not
// include" ("no supporting evidence — ask Carin"), but they have live pages, so
// per owner decision they are drafted rather than deleted — retrieval coming
// back empty is itself the evidence for the delete decision. Both are marked
// `disputed` so a draft cannot state an RP link the sources don't support.
//
// EVIDENCE TIER (the sheet's column D) is a real content-governance field, not
// decoration. Without it a reader cannot tell RHO — which causes most dominant
// RP — from PROS1, which has two families behind it. It is passed into the
// draft-generation prompt so that a candidate/disputed/phenotype-adjacent page
// states its own limits.
//
// ALIASES (column B) hold only aliases verified against HGNC, NCBI GTR, or
// GeneReviews. Blank means "not verified", NOT "none exist" — the retrieval
// pipeline pulls NCBI's full "Also known as" list at run time (see
// geneResearch/ncbi.ts), which is what keeps aliases current. These are a
// hand-verified supplement to that, not a replacement.
//
// DISEASE TERMS (column C) are what the gene symbol alone will not find.
// Someone with a CLRN1 result finds far more under "Usher syndrome type 3";
// searching CFAP418 without C8orf37 misses a decade of research.

import raw from "./geneCatalog.json";

/** How well established this gene's link to RP is. Drives page framing. */
export type EvidenceTier =
  | "established" // In GeneReviews NBK1417. Safe to state plainly.
  | "reported" // Real RP gene, published after the April 2023 GeneReviews revision.
  | "candidate" // One or two reports only. Page must say the evidence is limited.
  | "phenotype-adjacent" // Causes something else where RP is one feature. Page must explain that.
  | "disputed"; // Listed historically but later evidence did not support it.

export type CatalogGene = {
  gene: string;
  slug: string;
  /** Verified other gene symbols. Papers use whatever the gene was called at the time. */
  aliases: string[];
  /** Disease names this gene's research is published under. */
  diseaseTerms: string[];
  evidenceTier: EvidenceTier;
  /** The sheet's per-gene instruction for how the page must be framed. */
  framingNote: string;
};

export const geneCatalog: CatalogGene[] = raw as CatalogGene[];

const bySlug = new Map(geneCatalog.map((g) => [g.slug, g]));

export function getCatalogGene(slug: string): CatalogGene | undefined {
  return bySlug.get(slug.toLowerCase());
}

/** Human-readable label for a tier, for display on a gene page. */
export const EVIDENCE_TIER_LABEL: Record<EvidenceTier, string> = {
  established: "Established",
  reported: "Reported",
  candidate: "Candidate — limited evidence",
  "phenotype-adjacent": "Phenotype-adjacent",
  disputed: "Disputed",
};

/** Extra search terms the gene symbol alone would miss: verified aliases plus
 *  the disease names the literature is published under. Feeds the focused
 *  retrieval query — see geneResearch/pipeline.ts. */
export function getCatalogSearchTerms(slug: string): string[] {
  const g = bySlug.get(slug.toLowerCase());
  if (!g) return [];
  return [...g.aliases, ...g.diseaseTerms];
}
