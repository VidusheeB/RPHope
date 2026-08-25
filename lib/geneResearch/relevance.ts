// Conservative post-retrieval relevance gate. High-recall retrieval (broad +
// focused + ELink) deliberately over-fetches; this gate removes only records
// that are CLEARLY unrelated to the gene's retinal biology / inherited retinal
// disease before the bundle reaches Opus. It is intentionally cautious: when
// in doubt, KEEP the record (ranking and category-balanced selection already
// deprioritize weak evidence). It must never narrow retrieval back toward a
// keyword gate.
//
// A record is excluded only when:
//   (a) its dominant theme is a clearly non-IRD ophthalmic/other topic (e.g.
//       myopia control / orthokeratology / refractive error) AND it shows no
//       inherited-retinal-disease relevance — this catches papers where the
//       gene appears only as one entry in a broad panel/gene list; or
//   (b) it contains NO retinal-function, inherited-retinal-disease, phenotype,
//       mechanism, or treatment-research signal at all.
// Everything else is retained.

import type { LiteratureRecord } from "./types";

// Strong inherited-retinal-disease context — its presence ALWAYS retains a
// record, even if it also mentions an off-topic term in passing.
const IRD_TERMS =
  /\b(retinitis pigmentosa|leber congenital amaurosis|\bLCA\b|cone-?rod|rod-?cone|macular dystrophy|inherited retinal|retinal dystroph|retinal degenerat|photoreceptor degenerat|amaurosis|ciliopathy|usher syndrome|choroideremia|achromatopsia|retinal ciliopathy)\b/i;

// Retinal-function / phenotype / mechanism / treatment relevance — any of these
// is enough to retain (a mechanism paper needn't say "retinitis pigmentosa").
const RETINAL_RELEVANCE_TERMS =
  /\b(retina|retinal|photoreceptor|outer segment|connecting cilium|cilia\b|ciliary|fundus|electroretinogra|\bERG\b|visual acuity|visual field|nyctalopia|night blindness|nystagmus|rod\b|cone\b|opsin|phototransduction|gene therapy|gene augmentation|subretinal|retinal organoid)\b/i;

// Clearly non-IRD dominant themes. Excluded ONLY when no IRD context is present
// (so a genuine IRD paper that happens to mention one of these is still kept).
// A small, curated list of unrelated topics — not a per-PMID rule.
const OFF_TOPIC_TERMS =
  /\b(orthokeratolog|myopia control|\bmyopia\b|refractive error|cataract surgery|dry eye|amblyopia|strabismus|corneal (topography|refractive)|contact lens)\b/i;

export type RelevanceVerdict = { relevant: true } | { relevant: false; reason: string };

/** Build a matcher for this gene's own disease names (lib/geneCatalog.ts,
 *  column C). IRD_TERMS is a general list and cannot name every syndrome —
 *  without this, a genuine Bardet-Biedl paper about ARL6 that discusses
 *  obesity and polydactyly but no retinal term is dropped as irrelevant. These
 *  terms are passed PER GENE, so widening the gate for ARL6 cannot widen it
 *  for any other gene. */
function diseaseContextMatcher(diseaseTerms: string[]): RegExp | null {
  const escaped = diseaseTerms
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return null;
  return new RegExp(`(${escaped.join("|")})`, "i");
}

export function assessRelevance(
  record: Pick<LiteratureRecord, "title" | "abstract">,
  /** This gene's disease names — extra "always keep" context, same weight as
   *  IRD_TERMS. Defaults to none, preserving the original behaviour. */
  diseaseTerms: string[] = [],
): RelevanceVerdict {
  const text = `${record.title} ${record.abstract}`;

  const diseaseMatcher = diseaseContextMatcher(diseaseTerms);
  if (diseaseMatcher?.test(text)) return { relevant: true };

  const hasIrd = IRD_TERMS.test(text);
  // Strong IRD context overrides everything — always keep.
  if (hasIrd) return { relevant: true };

  const offTopic = text.match(OFF_TOPIC_TERMS);
  if (offTopic) {
    return {
      relevant: false,
      reason: `Dominant off-topic subject ("${offTopic[0]}") with no inherited-retinal-disease relevance — gene appears outside a retinal-disease context.`,
    };
  }

  if (!RETINAL_RELEVANCE_TERMS.test(text)) {
    return {
      relevant: false,
      reason:
        "No retinal-function, inherited-retinal-disease, phenotype, mechanism, or treatment relevance in title/abstract.",
    };
  }

  return { relevant: true };
}
