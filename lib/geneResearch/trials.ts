// Wraps the existing ClinicalTrials.gov v2 client (lib/trials/source.ts) to
// produce the trimmed TrialSummaryRecord shape the gene-page prompt needs.
// Reused rather than reimplemented — same registry, same mapping logic already
// used by the Clinical Trials Finder. Uses fetchTrialsResult (not the plain
// fetchTrials wrapper) so a hard failure is distinguishable from a legitimate
// zero-result search — required for the "required retrieval failed" reject
// condition.

import { fetchTrialsResult } from "../trials/source";
import type { TrialSummaryRecord } from "./types";

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
    records: result.records.map((t) => ({
      sourceId: `clinicaltrials:${t.id}`,
      nctId: t.id,
      title: t.title,
      status: t.status,
      studyType: t.study_type,
      geneSpecific: t.gene_scope === "gene_specific",
      briefSummary: t.brief_summary,
      url: t.source_url,
    })),
  };
}
