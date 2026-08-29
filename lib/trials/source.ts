// ClinicalTrials.gov API v2 adapter.
//
// The official public registry is our source-grounded trial data — global, free,
// no API key, always current. We fetch live, map each study to a TrialRecord, and
// hand only those real fields to the downstream AI explanation layer. Because the
// registry is the authoritative source, records are treated as "published"; the
// type still carries status_review so manually-authored records can be gated.

import type { TrialRecord } from "./types";
import { KNOWN_GENES } from "./normalize";
import { fetchWithRetry } from "../geneResearch/fetchRetry";

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
    last_update_posted:
      ps.statusModule?.lastUpdatePostDateStruct?.date ||
      ps.statusModule?.lastUpdateSubmitDate ||
      undefined,
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

export type FetchTrialsResult =
  | { ok: true; records: TrialRecord[] }
  | { ok: false; error: string };

/**
 * Same query as fetchTrials, but distinguishes a hard failure (network,
 * timeout, non-2xx) from a legitimate zero-result search — used by the
 * gene-page pipeline's "required retrieval failed" reject condition, which
 * needs that distinction. fetchTrials() below stays a thin, fully backward-
 * compatible wrapper for the Clinical Trials Finder's existing callers, which
 * only ever wanted a plain array and a graceful empty state either way.
 */
export async function fetchTrialsResult({
  condition,
  term,
  statuses,
  pageSize = 50,
  // Retries default OFF so the visitor-facing Clinical Trials Finder keeps its
  // fast, honest failure — nobody should wait through backoff for a search
  // page. The gene-page pipeline opts in, because there a dropped connection
  // rejects the whole gene and costs a manual re-run.
  retryAttempts = 1,
}: FetchTrialsParams & { retryAttempts?: number }): Promise<FetchTrialsResult> {
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
    const res = await fetchWithRetry(
      url.toString(),
      {
        signal: controller.signal,
        headers: { accept: "application/json" },
        // always hit the live registry; this route is force-dynamic
        cache: "no-store",
      },
      {
        attempts: retryAttempts,
        onRetry: (n, why) => console.warn(`  [trials] retry ${n} after ${why}`),
      }
    );
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json = await res.json();
    const studies: unknown[] = json?.studies || [];
    return {
      ok: true,
      records: studies.map(mapStudy).filter((t): t is TrialRecord => Boolean(t)),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchTrials(params: FetchTrialsParams): Promise<TrialRecord[]> {
  const result = await fetchTrialsResult(params);
  // network/timeout/non-2xx → caller shows the graceful "no results" copy,
  // matching this function's original behavior exactly.
  return result.ok ? result.records : [];
}

export type FetchStudyResult =
  | { ok: true; record: TrialRecord | null } // null = registry has no such study
  | { ok: false; error: string };

/**
 * Fetch ONE study directly by its NCT ID (CT.gov's /studies/{nctId} endpoint).
 * Used to resolve an NCT ID extracted from a publication without relying on a
 * gene-name search — the direct record is the authoritative one. Returns
 * `record: null` (not an error) when the registry legitimately has no such
 * study, so the caller can keep the citing publication and flag the trial as
 * unverified rather than treating a 404 as a hard failure.
 *
 * Defensively re-checks that the returned study's own nctId matches the one we
 * asked for — never map a mismatched record onto the requested ID.
 */
export async function fetchStudyByNctId(nctId: string): Promise<FetchStudyResult> {
  if (!/^NCT\d{8}$/i.test(nctId)) {
    return { ok: false, error: `malformed NCT ID: ${nctId}` };
  }
  const url = `${API}/${encodeURIComponent(nctId.toUpperCase())}?format=json`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 404) return { ok: true, record: null };
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const study = await res.json();
    const record = mapStudy(study);
    if (!record) return { ok: true, record: null };
    if (record.id.toUpperCase() !== nctId.toUpperCase()) {
      return {
        ok: false,
        error: `registry returned ${record.id} for requested ${nctId} (ID mismatch)`,
      };
    }
    return { ok: true, record };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}
