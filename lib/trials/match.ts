// Deterministic safety gates + ranking + section grouping.
//
// These rules run around the AI classification (lib/trials/explain.ts): hard
// gates trim the candidate set before the model sees it, and a final guard runs
// AFTER classification so the model can never promote a trial the rules forbid.
// The AI may classify relevance; it may NEVER decide eligibility — that stays in
// deterministic code and is always framed as "may be relevant to review."

import type {
  AgeGroup,
  ScoredTrial,
  TrialClassification,
  TrialFinderIntake,
  TrialRecord,
  TrialResultSections,
} from "./types";
import { canonGene } from "./geneUtil";
import { distanceKm as haversineKm, type GeoPoint } from "./geocode";

// Representative age span (years) for each group; null = don't gate on age.
export function ageRangeForGroup(group?: AgeGroup): [number, number] | null {
  switch (group) {
    case "under_6":
      return [0, 5];
    case "6_11":
      return [6, 11];
    case "12_17":
      return [12, 17];
    case "18_64":
      return [18, 64];
    case "65_plus":
      return [65, 120];
    default:
      return null; // prefer_not / undefined
  }
}

// "yes" = ranges overlap; "no" = clearly disjoint; "unknown" = trial has no
// usable bounds, so we never exclude on age.
export function ageCompatibility(
  trial: TrialRecord,
  range: [number, number] | null,
): "yes" | "no" | "unknown" {
  if (!range) return "yes";
  const lo = trial.age_min;
  const hi = trial.age_max;
  if (lo == null && hi == null) return "unknown";
  const tLo = lo ?? 0;
  const tHi = hi ?? 120;
  return tHi >= range[0] && tLo <= range[1] ? "yes" : "no";
}

const RP_TERMS =
  /retinitis|retinal|usher|leber|amaurosis|stargardt|cone[\s-]*rod|rod[\s-]*cone|choroidere|inherited\s*retina|macular|photoreceptor|\bIRD\b|\bRP\b/i;

export function rpRelevant(trial: TrialRecord): boolean {
  if (trial.genes.length > 0) return true;
  const hay = [trial.title, trial.brief_summary, trial.conditions.join(" ")]
    .filter(Boolean)
    .join(" ");
  return RP_TERMS.test(hay);
}

// True when a trial is locked to a single specific gene that ISN'T the user's
// confirmed gene — a clear conflict, safe to exclude.
export function geneConflict(trial: TrialRecord, confirmedGene?: string): boolean {
  if (!confirmedGene) return false;
  if (trial.gene_scope !== "gene_specific" || trial.genes.length !== 1) return false;
  return canonGene(trial.genes[0]) !== canonGene(confirmedGene);
}

const EXCLUDED_STATUSES = new Set([
  "COMPLETED",
  "WITHDRAWN",
  "TERMINATED",
  "SUSPENDED",
  "NO_LONGER_AVAILABLE",
]);

// Hard pre-AI gates. Returns the trials worth classifying.
export function applySafetyGates(
  trials: TrialRecord[],
  intake: TrialFinderIntake,
): TrialRecord[] {
  const range = ageRangeForGroup(intake.age_group);
  const confirmedGene =
    intake.gene_status === "known" ? intake.normalized_gene : undefined;
  const showPast = intake.recruiting_preference === "active_and_past";

  const seen = new Set<string>();
  return trials.filter((t) => {
    if (seen.has(t.id)) return false; // de-dupe across multiple queries
    seen.add(t.id);

    if (!showPast && EXCLUDED_STATUSES.has(t.status.toUpperCase())) return false;
    if (!rpRelevant(t)) return false;
    if (geneConflict(t, confirmedGene)) return false;
    if (ageCompatibility(t, range) === "no") return false;
    return true;
  });
}

// ---- Ranking ---------------------------------------------------------------

function statusRank(status: string): number {
  const s = status.toUpperCase();
  if (s === "RECRUITING") return 3;
  if (s === "NOT_YET_RECRUITING" || s === "ENROLLING_BY_INVITATION") return 2;
  if (s === "AVAILABLE" || s === "ACTIVE_NOT_RECRUITING") return 1;
  return 0;
}

function categoryRank(cat: TrialClassification["relevance_category"]): number {
  switch (cat) {
    case "strong_review_candidate":
      return 5;
    case "possible_review_candidate":
      return 4;
    case "broad_gene_agnostic_option":
      return 3;
    case "registry_or_observational":
      return 2;
    case "needs_clarification":
      return 1;
    default:
      return 0;
  }
}

function opportunityMatch(trial: TrialRecord, intake: TrialFinderIntake): boolean {
  const pref = intake.opportunity_type_preference;
  if (pref === "any" || pref === "not_sure") return true;
  const st = trial.study_type;
  if (pref === "treatment") return st === "interventional";
  if (pref === "observational") return st === "observational";
  if (pref === "registry") return st === "registry";
  if (pref === "screening") return st === "screening";
  return true;
}

function countryMatches(trial: TrialRecord, intake: TrialFinderIntake): boolean {
  if (!intake.country) return false;
  return trial.countries.some(
    (c) => c.toLowerCase() === intake.country.toLowerCase(),
  );
}

function isRemoteFriendly(trial: TrialRecord): boolean {
  return (
    trial.study_type === "registry" ||
    trial.study_type === "observational" ||
    trial.locations.length === 0
  );
}

// Km from the visitor to the trial's NEAREST site with coordinates (or undefined).
export function nearestSiteKm(trial: TrialRecord, geo: GeoPoint): number | undefined {
  let best: number | undefined;
  for (const loc of trial.locations) {
    if (loc.lat == null || loc.lng == null) continue;
    const d = haversineKm(geo, { lat: loc.lat, lng: loc.lng });
    if (best === undefined || d < best) best = d;
  }
  return best;
}

// Distance is a RANKING signal (rare-disease sites are often far), tuned to the
// visitor's travel scope. Never a hard exclusion.
function distanceBonus(d: number | undefined, intake: TrialFinderIntake): number {
  if (d === undefined) return 0;
  if (intake.travel_scope === "near_me" || intake.travel_scope === "state_region") {
    const radius = intake.travel_radius_km ?? 160;
    const withinBonus = d <= radius ? 12 : Math.max(-8, 4 - d / 80);
    return withinBonus - Math.min(d / 100, 6); // + continuous "closer is better"
  }
  return Math.max(0, 5 - d / 600); // gentle nudge for country/international
}

function computeRankScore(
  trial: TrialRecord,
  cls: TrialClassification,
  intake: TrialFinderIntake,
  geneKnown: boolean,
): number {
  let score = categoryRank(cls.relevance_category) * 10;
  score += statusRank(trial.status) * 2;

  if (geneKnown && trial.gene_scope === "gene_specific") score += 8;
  if (cls.confidence === "high") score += 3;
  else if (cls.confidence === "medium") score += 1;
  if (opportunityMatch(trial, intake)) score += 2;

  // Location is a ranking signal, not a hard filter (rare-disease trials are
  // often far away). Same-country and travel preferences nudge order only.
  if (intake.travel_scope === "remote_only") {
    score += isRemoteFriendly(trial) ? 6 : -6;
  } else if (intake.travel_scope === "country" || intake.travel_scope === "near_me") {
    if (countryMatches(trial, intake)) score += 4;
    else score -= 2;
  } else if (countryMatches(trial, intake)) {
    score += 2;
  }

  return score;
}

// Final guard + ranking + grouping. Runs AFTER AI classification.
export function rankAndGroup(
  pairs: { trial: TrialRecord; classification: TrialClassification }[],
  intake: TrialFinderIntake,
  geo?: GeoPoint | null,
): TrialResultSections {
  const geneKnown =
    intake.gene_status === "known" && Boolean(intake.normalized_gene);

  const scored: ScoredTrial[] = pairs
    .map(({ trial, classification }) => {
      let cls = classification;

      // Unknown-gene rule: a gene-specific study can never be a *strong* match
      // when the user hasn't confirmed a gene. Downgrade deterministically.
      if (
        !geneKnown &&
        trial.gene_scope === "gene_specific" &&
        cls.relevance_category === "strong_review_candidate"
      ) {
        cls = { ...cls, relevance_category: "possible_review_candidate" };
      }

      const distanceKm = geo ? nearestSiteKm(trial, geo) : undefined;

      return {
        trial,
        classification: cls,
        rankScore:
          computeRankScore(trial, cls, intake, geneKnown) +
          distanceBonus(distanceKm, intake),
        distanceKm,
      };
    })
    .filter((s) => s.classification.relevance_category !== "not_relevant")
    .sort((a, b) => b.rankScore - a.rankScore);

  const bestMatches: ScoredTrial[] = [];
  const broaderOptions: ScoredTrial[] = [];
  const registriesObservational: ScoredTrial[] = [];
  const otherStudies: ScoredTrial[] = [];

  for (const s of scored) {
    const cat = s.classification.relevance_category;
    const st = s.trial.study_type;
    if (cat === "registry_or_observational" || st === "registry") {
      registriesObservational.push(s);
    } else if (
      cat === "strong_review_candidate" ||
      cat === "possible_review_candidate"
    ) {
      bestMatches.push(s);
    } else if (cat === "broad_gene_agnostic_option") {
      broaderOptions.push(s);
    } else {
      otherStudies.push(s);
    }
  }

  return { bestMatches, broaderOptions, registriesObservational, otherStudies };
}
