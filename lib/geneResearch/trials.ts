// Wraps the existing ClinicalTrials.gov v2 client (lib/trials/source.ts) to
// produce the trimmed TrialSummaryRecord shape the gene-page prompt needs.
// Reused rather than reimplemented — same registry, same mapping logic already
// used by the Clinical Trials Finder.

import { fetchTrials } from "../trials/source";
import type { TrialSummaryRecord } from "./types";

/**
 * Fetch trials for a gene (condition: retinitis pigmentosa / inherited retinal
 * disease, term: the gene symbol). Never throws — returns [] on failure, which
 * the prompt/reviewer treats as "no trial records found," not an error.
 */
export async function fetchTrialSummaries(
  geneSymbol: string
): Promise<TrialSummaryRecord[]> {
  try {
    const trials = await fetchTrials({
      condition: "retinitis pigmentosa",
      term: geneSymbol,
      pageSize: 20,
    });
    return trials.map((t) => ({
      sourceId: `clinicaltrials:${t.id}`,
      nctId: t.id,
      title: t.title,
      status: t.status,
      studyType: t.study_type,
      geneSpecific: t.gene_scope === "gene_specific",
      briefSummary: t.brief_summary,
      url: t.source_url,
    }));
  } catch {
    return [];
  }
}
