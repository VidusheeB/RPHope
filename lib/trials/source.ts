// ClinicalTrials.gov API v2 adapter.
//
// The official public registry is our source-grounded trial data — global, free,
// no API key, always current. We fetch live, map each study to a TrialRecord, and
// hand only those real fields to the downstream AI explanation layer. Because the
// registry is the authoritative source, records are treated as "published"; the
// type still carries status_review so manually-authored records can be gated.

import type { TrialRecord } from "./types";
import { KNOWN_GENES } from "./normalize";

const API = "https://clinicaltrials.gov/api/v2/studies";

// Precompiled gene detectors (word-boundary, case-insensitive). Used to tag which
// known RP/IRD genes a study mentions, for relevance + matched_factors.
const GENE_PATTERNS: { gene: string; re: RegExp }[] = KNOWN_GENES.map((g) => ({
  gene: g,
  re: new RegExp(`\\b${g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
}));

function parseAgeToYears(raw?: string): number | undefined {
  if (!raw) return undefined;
  const m = raw.match(/(\d+)\s*(year|month|week|day)/i);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  if (unit.startsWith("year")) return n;
  if (unit.startsWith("month")) return Math.round((n / 12) * 10) / 10;
  return 0; // weeks/days → infants
}

function mapStudyType(
  raw: string | undefined,
  haystack: string,
): TrialRecord["study_type"] {
  const t = (raw || "").toUpperCase();
  if (/\bregistry\b/i.test(haystack) || /\bnatural history\b/i.test(haystack)) {
    return t === "INTERVENTIONAL" ? "interventional" : "registry";
  }
  if (/\bscreening\b/i.test(haystack) && t !== "INTERVENTIONAL") return "screening";
  if (t === "INTERVENTIONAL") return "interventional";
  if (t === "OBSERVATIONAL") return "observational";
  return "unknown";
}

function detectGenes(haystack: string): string[] {
  const found: string[] = [];
  for (const { gene, re } of GENE_PATTERNS) {
    if (re.test(haystack)) found.push(gene);
  }
  return Array.from(new Set(found));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapStudy(study: any): TrialRecord | null {
  const ps = study?.protocolSection;
  if (!ps) return null;
  const id: string | undefined = ps.identificationModule?.nctId;
  if (!id) return null;

  const title: string =
    ps.identificationModule?.briefTitle ||
    ps.identificationModule?.officialTitle ||
    id;
  const briefSummary: string | undefined = ps.descriptionModule?.briefSummary;
  const conditions: string[] = ps.conditionsModule?.conditions || [];
  const interventions: string[] = (ps.armsInterventionsModule?.interventions || [])
    .map((i: any) => i?.name)
    .filter(Boolean);
  const phases: string[] = ps.designModule?.phases || [];

  const haystack = [
    title,
    ps.identificationModule?.officialTitle,
    briefSummary,
    conditions.join(" "),
    interventions.join(" "),
  ]
    .filter(Boolean)
    .join("  ");

  const genes = detectGenes(haystack);
  const gene_scope: TrialRecord["gene_scope"] =
    genes.length === 1
      ? "gene_specific"
      : genes.length > 1
        ? "unknown_or_mixed"
        : "gene_agnostic";

  const locationsRaw: any[] = ps.contactsLocationsModule?.locations || [];
  const locations = locationsRaw.map((l) => ({
    facility: l?.facility,
    city: l?.city,
    region: l?.state,
    country: l?.country,
    lat: l?.geoPoint?.lat,
    lng: l?.geoPoint?.lon,
  }));
  const countries = Array.from(
    new Set(locations.map((l) => l.country).filter(Boolean) as string[]),
  );

  const contactsRaw: any[] = ps.contactsLocationsModule?.centralContacts || [];
  const contacts = contactsRaw.map((c) => ({
    name: c?.name,
    email: c?.email,
    phone: c?.phone,
  }));

  return {
    id,
    source: "clinicaltrials_gov",
    source_url: `https://clinicaltrials.gov/study/${id}`,
    title,
    brief_summary: briefSummary,
    official_summary: ps.descriptionModule?.detailedDescription,
    status: ps.statusModule?.overallStatus || "UNKNOWN",
    conditions,
    genes,
    gene_scope,
    study_type: mapStudyType(ps.designModule?.studyType, haystack),
    intervention_names: interventions,
    phase: phases.length ? phases.join(", ") : undefined,
    age_min: parseAgeToYears(ps.eligibilityModule?.minimumAge),
    age_max: parseAgeToYears(ps.eligibilityModule?.maximumAge),
    accepts_healthy_volunteers: ps.eligibilityModule?.healthyVolunteers,
    countries,
    locations,
    eligibility_text: ps.eligibilityModule?.eligibilityCriteria,
    contacts,
    last_synced_at: new Date().toISOString(),
    status_review: "published",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export type FetchTrialsParams = {
  condition: string; // ClinicalTrials.gov condition term
  term?: string; // extra term, e.g. a gene symbol
  statuses?: string[]; // overallStatus filter values
  pageSize?: number;
};

export async function fetchTrials({
  condition,
  term,
  statuses,
  pageSize = 50,
}: FetchTrialsParams): Promise<TrialRecord[]> {
  const url = new URL(API);
  url.searchParams.set("query.cond", condition);
  if (term) url.searchParams.set("query.term", term);
  if (statuses && statuses.length) {
    url.searchParams.set("filter.overallStatus", statuses.join(","));
  }
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("format", "json");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { accept: "application/json" },
      // always hit the live registry; this route is force-dynamic
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    const studies: unknown[] = json?.studies || [];
    return studies
      .map(mapStudy)
      .filter((t): t is TrialRecord => Boolean(t));
  } catch {
    return []; // network/timeout → caller shows the graceful "no results" copy
  } finally {
    clearTimeout(timeout);
  }
}
