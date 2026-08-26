// Reader-facing explanation of each evidence tier, for gene pages.
//
// The tiers come from RP_Hope_genes_to_include_94.xlsx. The sheet's own README
// makes the case for showing them: without this, a reader cannot tell RHO,
// which causes most dominant RP, from PROS1, which has two published families
// behind it. Both would otherwise look like equally settled "RP genes".
//
// Wording is deliberately non-alarming — the point is calibration, not
// discouragement — and it never tells anyone what their result means. Written
// by hand, not AI-generated, so it carries no review gate; it restates the
// sheet's tier definitions in everyday language.

import type { EvidenceTier } from "./geneCatalog";

export const EVIDENCE_TIER_NOTE: Record<EvidenceTier, string> = {
  established:
    "This gene's link to retinitis pigmentosa is well established in the medical literature.",
  reported:
    "This gene is linked to retinitis pigmentosa in published research, but the reports came after the last major reference review, so you may find it missing from some older gene lists.",
  candidate:
    "Only one or two studies have linked this gene to retinitis pigmentosa so far. The evidence is limited, and understanding may change as more families are described.",
  "phenotype-adjacent":
    "This gene is associated with a broader condition in which retinal changes are one feature among several — it is not limited to the eyes. A genetic counsellor or clinician can explain what that means in your case.",
  disputed:
    "This gene has appeared on lists of retinitis pigmentosa genes historically, but later evidence did not support a clear link. We show it so the name is findable, not as a confirmed cause.",
};
