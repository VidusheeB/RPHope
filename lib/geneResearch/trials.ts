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

export async function fetchTrialSummaries(
  geneSymbol: string
): Promise<{ ok: true; records: TrialSummaryRecord[] } | { ok: false; error: string }> {
  const result = await fetchTrialsResult({
    condition: "retinitis pigmentosa",
    term: geneSymbol,
    pageSize: 20,
  });

  if (!result.ok) {
    console.warn(`  [trials] fetch failed for ${geneSymbol}: ${result.error}`);
    return { ok: false, error: result.error };
  }

  return {
    ok: true,
    records: result.records.map((t) => toSummary(t, "gene_search")),
  };
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
