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
  ExcludedTrialRecord,
} from "./types";

/** Does this registry record's own text name `geneSymbol` (or an alias)?
 *
 *  Case-insensitive exact symbol match against the genes CT.gov's mapping
 *  detected — substring matching would make CFAP418 match "CFAP418L" and
 *  BBS1 match "BBS10". */
function namesGene(targetGenes: string[], geneSymbol: string, aliases: string[]): boolean {
  const wanted = new Set(
    [geneSymbol, ...aliases].map((g) => g.trim().toUpperCase()).filter(Boolean)
  );
  return targetGenes.some((g) => wanted.has(g.trim().toUpperCase()));
}

/** How a trial relates to the gene whose page we are drafting.
 *
 *  This is decided from the trial's OWN detected genes, never from which query
 *  found it. Both of the review's trial errors came from the old inference:
 *  a study found via the syndrome search was forced to `geneSpecific: false`
 *  even when it targeted this gene (BF844 → CLRN1), and a study targeting a
 *  different gene rode the syndrome search into the bundle (AXV-101 → BBS1 on
 *  the CFAP418 page). */
export function classifyTrialForGene(
  targetGenes: string[],
  geneSymbol: string,
  aliases: string[] = []
): "gene_specific" | "other_gene" | "not_gene_targeted" {
  if (!targetGenes.length) return "not_gene_targeted";
  if (namesGene(targetGenes, geneSymbol, aliases)) return "gene_specific";
  return "other_gene";
}

function toSummary(
  t: TrialRecord,
  provenance: TrialProvenance,
  geneSpecific: boolean,
  referencedBySourceIds?: string[]
): TrialSummaryRecord {
  return {
    sourceId: `clinicaltrials:${t.id}`,
    nctId: t.id,
    title: t.title,
    status: t.status,
    studyType: t.study_type,
    geneSpecific,
    briefSummary: t.brief_summary,
    url: t.source_url,
    provenance,
    // Audit fields — a reviewer must be able to re-check a status or phase
    // claim against the registry without re-running the pipeline.
    phase: t.phase,
    conditions: t.conditions,
    interventionNames: t.intervention_names,
    targetGenes: t.genes,
    lastUpdatePosted: t.last_update_posted,
    retrievedAt: t.last_synced_at,
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
  diseaseTerms: string[] = [],
  aliases: string[] = []
): Promise<
  | { ok: true; records: TrialSummaryRecord[]; excluded: ExcludedTrialRecord[] }
  | { ok: false; error: string }
> {
  const result = await fetchTrialsResult({
    condition: buildTrialCondition(diseaseTerms),
    term: geneSymbol,
    pageSize: 20,
    // Required retrieval for a gene run — a transient failure here rejects the
    // gene, so retry rather than lose it from the batch.
    retryAttempts: 3,
  });

  if (!result.ok) {
    console.warn(`  [trials] fetch failed for ${geneSymbol}: ${result.error}`);
    return { ok: false, error: result.error };
  }

  const byNct = new Map<string, TrialSummaryRecord>();
  const excluded: ExcludedTrialRecord[] = [];

  // Gene-specificity comes from the registry record's own detected genes, and a
  // study that targets a DIFFERENT gene is dropped here rather than presented
  // as a syndrome-level option. Dropped records are returned for the audit log,
  // never for the prompt.
  const consider = (t: TrialRecord, provenance: TrialProvenance) => {
    const key = t.id.toUpperCase();
    if (byNct.has(key)) return;
    const relation = classifyTrialForGene(t.genes ?? [], geneSymbol, aliases);
    if (relation === "other_gene") {
      if (!excluded.some((e) => e.nctId === key)) {
        excluded.push({
          nctId: key,
          title: t.title,
          targetGenes: t.genes ?? [],
          reason: `Targets ${(t.genes ?? []).join(", ")}, not ${geneSymbol}.`,
        });
      }
      return;
    }
    byNct.set(key, toSummary(t, provenance, relation === "gene_specific"));
  };

  for (const t of result.records) consider(t, "gene_search");

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
      retryAttempts: 3,
    });
    if (!byDisease.ok) {
      // Best-effort: the gene-term results above are already in hand, so a
      // failure here thins the bundle rather than sinking the gene.
      console.warn(`  [trials] disease search failed for "${term}": ${byDisease.error}`);
      continue;
    }
    // NOTE: these are no longer force-marked geneSpecific:false. A syndrome
    // search legitimately surfaces gene-specific studies (BF844 is registered
    // under Usher syndrome type 3 but is built around mutant CLRN1 N48K), so
    // `consider` reads the record's own genes instead of assuming.
    for (const t of byDisease.records) consider(t, "disease_search");
  }

  return { ok: true, records: Array.from(byNct.values()), excluded };
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
  references: { nctId: string; referencedBySourceIds: string[] }[],
  geneSymbol: string,
  aliases: string[] = []
): Promise<{
  merged: TrialSummaryRecord[];
  unverified: UnverifiedTrialReference[];
  excluded: ExcludedTrialRecord[];
}> {
  const byNct = new Map<string, TrialSummaryRecord>();
  for (const t of geneSearchTrials) byNct.set(t.nctId.toUpperCase(), t);

  const unverified: UnverifiedTrialReference[] = [];
  const excluded: ExcludedTrialRecord[] = [];

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
      // A paper can name a trial for a different gene (a comparison arm, a
      // related programme). Same rule as the gene search: classify from the
      // registry record's own genes, and quarantine another gene's study.
      const relation = classifyTrialForGene(study.record.genes ?? [], geneSymbol, aliases);
      if (relation === "other_gene") {
        excluded.push({
          nctId: key,
          title: study.record.title,
          targetGenes: study.record.genes ?? [],
          reason: `Referenced by selected literature but targets ${(study.record.genes ?? []).join(", ")}, not ${geneSymbol}.`,
        });
        continue;
      }
      byNct.set(
        key,
        toSummary(
          study.record,
          "discovered_from_literature",
          relation === "gene_specific",
          ref.referencedBySourceIds
        )
      );
    } else {
      const reason = study.ok
        ? "ClinicalTrials.gov has no study with this ID (registry record could not be verified)."
        : `ClinicalTrials.gov lookup failed: ${study.error}`;
      console.warn(`  [trials] NCT ${ref.nctId} from literature unresolved: ${reason}`);
      unverified.push({ nctId: key, referencedBySourceIds: ref.referencedBySourceIds, reason });
    }
  }

  return { merged: Array.from(byNct.values()), unverified, excluded };
}
