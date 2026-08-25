// Wraps the existing ClinicalTrials.gov v2 client (lib/trials/source.ts) to
// produce the trimmed TrialSummaryRecord shape the gene-page prompt needs.
// Reused rather than reimplemented — same registry, same mapping logic already
// used by the Clinical Trials Finder. Uses fetchTrialsResult (not the plain
// fetchTrials wrapper) so a hard failure is distinguishable from a legitimate
// zero-result search — required for the "required retrieval failed" reject
// condition.

import { fetchTrialsResult, fetchStudyByNctId } from "../trials/source";
import type { TrialRecord } from "../trials/types";
import type {
  TrialSummaryRecord,
  TrialProvenance,
  UnverifiedTrialReference,
} from "./types";

function toSummary(
  t: TrialRecord,
  provenance: TrialProvenance,
  referencedBySourceIds?: string[]
): TrialSummaryRecord {
  return {
    sourceId: `clinicaltrials:${t.id}`,
    nctId: t.id,
    title: t.title,
    status: t.status,
    studyType: t.study_type,
    geneSpecific: t.gene_scope === "gene_specific",
    briefSummary: t.brief_summary,
    url: t.source_url,
    provenance,
    ...(referencedBySourceIds && referencedBySourceIds.length
      ? { referencedBySourceIds }
      : {}),
  };
}

/** ClinicalTrials.gov `query.cond` value for a gene.
 *
 *  "retinitis pigmentosa" alone is NOT enough. Many RP genes' trials are
 *  registered under the syndrome, not under RP: CLRN1's studies are listed as
 *  Usher syndrome type 3, ABCA4's as Stargardt disease, HGSNAT's as Sanfilippo
 *  syndrome. Searching only the RP condition silently returned zero trials for
 *  those genes. The disease terms come from lib/geneCatalog.ts (the sheet's
 *  column C), which is exactly the "feed the API the disease names too" note in
 *  its README.
 *
 *  Terms are OR'd using CT.gov v2's Essie expression syntax, and quoted so a
 *  multi-word disease name matches as a phrase rather than as loose words. */
export function buildTrialCondition(diseaseTerms: string[]): string {
  const terms = ["retinitis pigmentosa", ...diseaseTerms]
    .map((t) => t.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique = terms.filter((t) => {
    const k = t.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique.map((t) => `"${t.replace(/"/g, "")}"`).join(" OR ");
}

export async function fetchTrialSummaries(
  geneSymbol: string,
  diseaseTerms: string[] = []
): Promise<{ ok: true; records: TrialSummaryRecord[] } | { ok: false; error: string }> {
  const result = await fetchTrialsResult({
    condition: buildTrialCondition(diseaseTerms),
    term: geneSymbol,
    pageSize: 20,
  });

  if (!result.ok) {
    console.warn(`  [trials] fetch failed for ${geneSymbol}: ${result.error}`);
    return { ok: false, error: result.error };
  }

  const byNct = new Map<string, TrialSummaryRecord>();
  for (const t of result.records) {
    byNct.set(t.id.toUpperCase(), toSummary(t, "gene_search"));
  }

  // Second pass: the gene's own syndrome, with NO gene term. Most syndrome
  // trials never name the causative gene, so the gene-term search above returns
  // zero for ARL6 (Bardet-Biedl), CLRN1 (Usher type 3), HGSNAT (Sanfilippo) and
  // similar — studies someone with that gene could genuinely look at. These are
  // marked "disease_search" and geneSpecific: false so the draft presents them
  // as syndrome-level, never as gene-specific. This is NOT the "generic trials
  // that merely mention inherited retinal disease" case: the condition searched
  // is this gene's own disease, not a blanket RP query.
  for (const term of diseaseTerms) {
    const byDisease = await fetchTrialsResult({
      condition: `"${term.replace(/"/g, "")}"`,
      pageSize: 20,
    });
    if (!byDisease.ok) {
      // Best-effort: the gene-term results above are already in hand, so a
      // failure here thins the bundle rather than sinking the gene.
      console.warn(`  [trials] disease search failed for "${term}": ${byDisease.error}`);
      continue;
    }
    for (const t of byDisease.records) {
      const key = t.id.toUpperCase();
      if (byNct.has(key)) continue; // the gene-specific hit is the stronger one
      byNct.set(key, { ...toSummary(t, "disease_search"), geneSpecific: false });
    }
  }

  return { ok: true, records: Array.from(byNct.values()) };
}

/**
 * Resolve NCT IDs extracted from selected literature by fetching each study
 * DIRECTLY from ClinicalTrials.gov (not another gene search), and merge them
 * into the gene-search trial set. Never invents a record: an NCT that CT.gov
 * can't return is returned as an `unverified` reference instead, keeping the
 * citing publication but not asserting a live trial.
 *
 * Merge/dedup rules (spec):
 *  - deduplicate by NCT ID;
 *  - prefer the direct ClinicalTrials.gov record over publication-quoted info;
 *  - when a gene-search trial is ALSO named by a paper, annotate it with the
 *    referencing publication IDs rather than adding a duplicate.
 */
export async function mergeLiteratureReferencedTrials(
  geneSearchTrials: TrialSummaryRecord[],
  references: { nctId: string; referencedBySourceIds: string[] }[]
): Promise<{ merged: TrialSummaryRecord[]; unverified: UnverifiedTrialReference[] }> {
  const byNct = new Map<string, TrialSummaryRecord>();
  for (const t of geneSearchTrials) byNct.set(t.nctId.toUpperCase(), t);

  const unverified: UnverifiedTrialReference[] = [];

  for (const ref of references) {
    const key = ref.nctId.toUpperCase();
    const existing = byNct.get(key);
    if (existing) {
      // Already have the direct record from the gene search — just record that
      // a publication referenced it too (union of source IDs).
      existing.referencedBySourceIds = Array.from(
        new Set([...(existing.referencedBySourceIds ?? []), ...ref.referencedBySourceIds])
      );
      continue;
    }

    const study = await fetchStudyByNctId(ref.nctId);
    if (study.ok && study.record) {
      byNct.set(key, toSummary(study.record, "discovered_from_literature", ref.referencedBySourceIds));
    } else {
      const reason = study.ok
        ? "ClinicalTrials.gov has no study with this ID (registry record could not be verified)."
        : `ClinicalTrials.gov lookup failed: ${study.error}`;
      console.warn(`  [trials] NCT ${ref.nctId} from literature unresolved: ${reason}`);
      unverified.push({ nctId: key, referencedBySourceIds: ref.referencedBySourceIds, reason });
    }
  }

  return { merged: Array.from(byNct.values()), unverified };
}
