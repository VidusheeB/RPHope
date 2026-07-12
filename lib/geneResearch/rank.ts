// Evidence classification, scoring, deduplication, and category-balanced
// selection for literature records (PubMed + Europe PMC). No network calls,
// fully unit-testable.
//
// Retrieval is now high-recall (broad gene search + focused retinal search +
// ELink, each uncapped at the query level) — ranking and selection are what
// actually decide what reaches Opus. Per the retrieval spec: "Rank after
// retrieval rather than using disease keywords as a gate," and build a
// "category-balanced evidence selection" across five buckets rather than a
// flat top-N by score.

import type {
  EvidenceCategory,
  FoundBy,
  LiteratureRecord,
  TrialSummaryRecord,
} from "./types";

const CURRENT_YEAR = new Date().getFullYear();

const RETINAL_TERMS = [
  "retina", "retinal", "photoreceptor", "blindness", "dystrophy",
  "retinitis pigmentosa", "rod-cone", "cone-rod", "macular",
  "leber congenital amaurosis", "early-onset severe retinal dystrophy",
  "ciliopathy", "night blindness", "nyctalopia", "inherited retinal disease",
];

// ---- Classification into the 5-bucket taxonomy -----------------------------
//
// A keyword heuristic must NOT classify a study as "treatment" just because
// the abstract contains bare words like treatment/therapy/therapeutic/trial/
// gene therapy — those appear constantly in the discussion/outlook of cohort,
// diagnostic, and genetic studies ("these data support future enrolment in
// gene-therapy trials"). Doing so floods the treatment bucket with what are
// really phenotype/diagnostic papers. Classification therefore keys on what
// the study ACTUALLY DID, in this precedence:
//
//   1. Review / meta-analysis  → review        (a survey of the field)
//   2. Preclinical (animal/lab) → preclinical  (even if it discusses AAV,
//      gene therapy, rescue, or treatment POTENTIAL — it's still bench work)
//   3. Human interventional     → treatment_clinical  (ONLY when the study
//      administers, compares, or evaluates an intervention / reports clinical
//      treatment outcomes — signalled by trial design, administration route,
//      dosing, adverse events, or safety+efficacy evaluation)
//   4. Human cohort / diagnostic / genetic / phenotype / natural-history
//                               → human_phenotype_natural_history  (even with
//      incidental "future therapy / trial eligibility" language)
//   5. otherwise                → other

// A genuine literature/synthesis review — NOT bare "review", which would catch
// "retrospective chart review" / "review of records" (those are cohort work).
const REVIEW_TERMS =
  /\b(systematic review|meta-?analysis|scoping review|literature review|narrative review|review article|umbrella review)\b/i;

// Bench work: animal models or laboratory/cell systems. Checked before the
// treatment bucket, so an AAV / gene-therapy study done in mice or cells is
// preclinical, not "treatment".
const PRECLINICAL_TERMS =
  /\b(mouse|mice|murine|zebrafish|drosophila|xenopus|canine|porcine|rat model|animal model|in vitro|ex vivo|cell culture|cultured cells?|cell line|fibroblasts?|organoid|retinal organoid|induced pluripotent|ipsc|hek ?293|crispr screen|knock-?out|knock-?in|patient-derived)\b/i;

// The study ITSELF administered / evaluated an intervention. Deliberately does
// NOT include bare "clinical trial", "trial", "treatment", "therapy", or
// "gene therapy" — a diagnostic cohort routinely mentions trial eligibility or
// future gene therapy without being an interventional study. These are signals
// that treatment was actually studied: trial phase/design, administration
// route, dosing, adverse events, or a safety/efficacy evaluation.
const INTERVENTIONAL_TERMS =
  /\b(phase\s+(?:1|2|3|i{1,3}|iv)\b|randomi[sz]ed|double-?blind|placebo-?controlled|open-?label|dose-?escalation|first-?in-?human|subretinal (injection|delivery|administration)|intravitreal (injection|administration)|adverse events?|serious adverse|safety and efficacy|efficacy and safety|treated patients|patients were treated|patients (who )?received|interventional (study|trial))\b/i;

// Human cohort / diagnostic / genetic / phenotype / natural-history study.
const HUMAN_STUDY_TERMS =
  /\b(cohort|case report|case series|genotype-?phenotype|natural history|longitudinal|panel sequencing|whole[- ]exome|whole[- ]genome|targeted (next-generation )?sequencing|diagnostic yield|molecular diagnos(is|tic)|probands?|pedigree|consanguineous|segregat(e|ed|ing|ion)|mutation spectrum|variant spectrum|prevalence|retrospective|patients?|participants?|subjects|families|phenotyp)\b/i;

/**
 * Classify a candidate into one of the 5 spec-defined buckets. See the block
 * comment above for the precedence and why bare treatment/therapy vocabulary
 * is intentionally NOT a trigger.
 */
export function classifyEvidence(title: string, abstract: string): EvidenceCategory {
  const text = `${title} ${abstract}`;

  if (REVIEW_TERMS.test(text)) return "review";
  if (PRECLINICAL_TERMS.test(text)) return "preclinical_mechanism";
  if (INTERVENTIONAL_TERMS.test(text)) return "treatment_clinical";
  if (HUMAN_STUDY_TERMS.test(text)) return "human_phenotype_natural_history";
  return "other";
}

// ---- Scoring ----------------------------------------------------------------

// Priority weight per category — human phenotype/natural-history and
// treatment/clinical evidence rank highest (the spec's top two priorities:
// "direct gene-specific retinal evidence; human studies... natural-history
// and genotype-phenotype studies"), reviews next, preclinical mechanism work
// still counts (explicitly wanted) but lower, "other" gets no bonus.
const CATEGORY_WEIGHT: Record<EvidenceCategory, number> = {
  human_phenotype_natural_history: 6,
  treatment_clinical: 5,
  review: 4,
  preclinical_mechanism: 2,
  other: 0,
};

export function scoreLiteratureRecord(
  record: Pick<LiteratureRecord, "title" | "abstract" | "year">,
  geneSymbol: string
): number {
  const haystack = `${record.title} ${record.abstract}`.toLowerCase();
  const symbol = geneSymbol.toLowerCase();
  let score = 0;

  // Gene symbol mentioned — strong topical signal ("direct gene-specific
  // evidence" from the spec). Retrieval no longer requires this (the broad
  // search doesn't gate on it), so it's purely a ranking signal now.
  if (new RegExp(`\\b${symbol}\\b`, "i").test(haystack)) score += 5;

  // Retinal-disease vocabulary present — the focused-search terms, now used
  // for ranking rather than as a retrieval gate.
  for (const term of RETINAL_TERMS) {
    if (haystack.includes(term)) score += 2;
  }

  // Recency bonus, capped so very old work isn't zeroed out entirely.
  if (record.year) {
    const age = CURRENT_YEAR - record.year;
    score += Math.max(0, 5 - Math.floor(age / 2));
  }

  score += CATEGORY_WEIGHT[classifyEvidence(record.title, record.abstract)];

  return score;
}

// ---- Dedup (preserving provenance) ------------------------------------------

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deduplicate literature records across sources/queries by PMID, then DOI,
 * then normalized title. Unlike a plain "keep first" dedup, this MERGES
 * `foundBy` across duplicates — a candidate found by both PubMed's broad
 * search AND ELink is a stronger relevance signal than either alone, and
 * that signal is preserved here, not discarded. Does NOT sort or cap — that
 * is selectCategoryBalancedEvidence's job, run after this.
 */
export function dedupeLiterature(records: LiteratureRecord[]): LiteratureRecord[] {
  const byPmid = new Map<string, LiteratureRecord>();
  const byDoi = new Map<string, LiteratureRecord>();
  const byTitle = new Map<string, LiteratureRecord>();
  const out: LiteratureRecord[] = [];

  for (const r of records) {
    const pmidKey = r.pmid?.trim();
    const doiKey = r.doi?.trim().toLowerCase();
    const titleKey = normalizeTitle(r.title);

    const existing =
      (pmidKey && byPmid.get(pmidKey)) ||
      (doiKey && byDoi.get(doiKey)) ||
      (titleKey && byTitle.get(titleKey));

    if (existing) {
      // Merge provenance into the first-seen record; keep the richer
      // abstract if the duplicate has one and the original doesn't.
      existing.foundBy = Array.from(new Set([...existing.foundBy, ...r.foundBy]));
      if (!existing.abstract && r.abstract) existing.abstract = r.abstract;
      if (!existing.doi && r.doi) existing.doi = r.doi;
      continue;
    }

    if (pmidKey) byPmid.set(pmidKey, r);
    if (doiKey) byDoi.set(doiKey, r);
    if (titleKey) byTitle.set(titleKey, r);
    out.push(r);
  }

  return out;
}

// ---- Category-balanced selection --------------------------------------------

const CATEGORIES: EvidenceCategory[] = [
  "human_phenotype_natural_history",
  "review",
  "treatment_clinical",
  "preclinical_mechanism",
  "other",
];

export type SelectionResult = {
  selected: LiteratureRecord[];
  excluded: LiteratureRecord[];
};

/**
 * Select up to `limit` records from a deduplicated, scored candidate pool,
 * balanced across the 5 evidence categories rather than a flat top-N by
 * score (which would let one category — usually "other"/general human
 * studies — crowd out reviews or mechanism work entirely for a
 * well-published gene). Algorithm:
 *   1. Give each of the first 4 categories (human/review/treatment/
 *      preclinical) a quota of floor(limit / 5), highest-scored first.
 *   2. Fill remaining slots (including "other"'s share and any unused quota
 *      from under-populated categories) with the highest-scoring remaining
 *      candidates regardless of category — the spec's "additional
 *      highest-relevance evidence" bucket.
 * Every excluded record gets a concrete, human-readable reason.
 */
export function selectCategoryBalancedEvidence(
  candidates: LiteratureRecord[],
  limit: number
): SelectionResult {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const perCategoryQuota = Math.max(1, Math.floor(limit / CATEGORIES.length));

  const selected: LiteratureRecord[] = [];
  const selectedIds = new Set<string>();
  const countByCategory: Record<EvidenceCategory, number> = {
    human_phenotype_natural_history: 0,
    review: 0,
    treatment_clinical: 0,
    preclinical_mechanism: 0,
    other: 0,
  };

  // Pass 1: fill each priority category's quota (not "other" — that's the
  // fill-remaining pass) with its highest-scoring members.
  for (const category of CATEGORIES.filter((c) => c !== "other")) {
    for (const r of sorted) {
      if (selected.length >= limit) break;
      if (countByCategory[category] >= perCategoryQuota) break;
      if (selectedIds.has(r.sourceId)) continue;
      if (r.evidenceCategory !== category) continue;
      r.selected = true;
      selected.push(r);
      selectedIds.add(r.sourceId);
      countByCategory[category]++;
    }
  }

  // Pass 2: fill remaining slots with the highest-scoring leftovers,
  // regardless of category (the "additional highest-relevance evidence"
  // bucket, and where "other"-category records get in).
  for (const r of sorted) {
    if (selected.length >= limit) break;
    if (selectedIds.has(r.sourceId)) continue;
    r.selected = true;
    selected.push(r);
    selectedIds.add(r.sourceId);
    countByCategory[r.evidenceCategory]++;
  }

  const excluded = sorted.filter((r) => !selectedIds.has(r.sourceId));
  for (const r of excluded) {
    r.selected = false;
    r.exclusionReason = `Evidence cap reached (${limit} selected, category-balanced); this candidate's rank did not qualify (score ${r.score}, category "${r.evidenceCategory}").`;
  }

  return { selected, excluded };
}

// ---- Trial ranking ---------------------------------------------------------
// ClinicalTrials.gov can return many weakly-relevant studies for a broad
// condition search. Per the pipeline spec, we do NOT hand every raw trial to
// Opus — only the strongest, ranked subset needed for an accurate summary.

const ACTIVE_STATUSES = new Set(["RECRUITING", "ENROLLING_BY_INVITATION", "NOT_YET_RECRUITING"]);
const INACTIVE_STATUSES = new Set(["WITHDRAWN", "TERMINATED", "SUSPENDED"]);

export function scoreTrialRecord(trial: TrialSummaryRecord): number {
  let score = 0;
  score += trial.geneSpecific ? 10 : 2;

  const status = trial.status.toUpperCase();
  if (ACTIVE_STATUSES.has(status)) score += 4;
  else if (status === "ACTIVE_NOT_RECRUITING") score += 3;
  else if (status === "COMPLETED") score += 2; // still valuable evidence
  else if (INACTIVE_STATUSES.has(status)) score -= 2; // deprioritize, don't exclude

  if (trial.studyType === "interventional") score += 2;
  else if (trial.studyType === "registry" || trial.studyType === "observational") score += 1;

  return score;
}

export function rankAndCapTrials(
  trials: TrialSummaryRecord[],
  limit = 15
): TrialSummaryRecord[] {
  return [...trials]
    .sort((a, b) => scoreTrialRecord(b) - scoreTrialRecord(a))
    .slice(0, limit);
}

// Re-exported for callers that only need the "found by" union type shape.
export type { FoundBy };
