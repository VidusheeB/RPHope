// Clinical Trials Finder — matching endpoint.
//
// Orchestrates: normalize → fetch real CT.gov trials → deterministic safety gates
// → AI relevance classification → final guard + ranking + section grouping.
// Returns "may be relevant to review" results only; never an eligibility decision.

import { NextResponse } from "next/server";
import type {
  TrialFinderIntake,
  TrialMatchResponse,
  TrialRecord,
} from "@/lib/trials/types";
import { normalizeCondition, normalizeGene } from "@/lib/trials/normalize";
import { fetchTrials } from "@/lib/trials/source";
import { applySafetyGates, rankAndGroup } from "@/lib/trials/match";
import { classifyTrials } from "@/lib/trials/explain";
import { geocodeLocation, type GeoPoint } from "@/lib/trials/geocode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // always hit the live registry

const MAX_CANDIDATES = 40; // cap candidates sent through classification

function statusesFor(pref: TrialFinderIntake["recruiting_preference"]): string[] {
  switch (pref) {
    case "recruiting_only":
      return ["RECRUITING"];
    case "active_and_past":
      return []; // no status filter → include past studies too
    case "recruiting_or_not_yet":
    case "not_sure":
    default:
      return [
        "RECRUITING",
        "NOT_YET_RECRUITING",
        "ENROLLING_BY_INVITATION",
        "AVAILABLE",
      ];
  }
}

function emptyResponse(
  note: string,
  geneKnown: boolean,
  normalizedGene?: string,
  normalizedCondition?: string,
): TrialMatchResponse {
  return {
    sections: {
      bestMatches: [],
      broaderOptions: [],
      registriesObservational: [],
      otherStudies: [],
    },
    totalConsidered: 0,
    totalShown: 0,
    geneKnown,
    normalizedGene,
    normalizedCondition,
    contextNote: note,
    noResults: true,
  };
}

export async function POST(req: Request) {
  let intake: TrialFinderIntake;
  try {
    intake = (await req.json()) as TrialFinderIntake;
  } catch {
    return NextResponse.json(
      emptyResponse(
        "We could not read your request. Please try again.",
        false,
      ),
      { status: 400 },
    );
  }

  // Re-normalize server-side (don't trust the client to have done it).
  const cond = normalizeCondition(intake.condition_input || "");
  const normalizedCondition = intake.normalized_condition || cond.normalized;

  let normalizedGene = intake.normalized_gene;
  if (intake.gene_status === "known" && intake.raw_gene_input && !normalizedGene) {
    const g = normalizeGene(intake.raw_gene_input);
    if (g.status === "exact" || g.status === "corrected") normalizedGene = g.normalized;
  }
  const geneKnown = intake.gene_status === "known" && Boolean(normalizedGene);

  // Keep the server's view consistent for the downstream layers.
  const resolvedIntake: TrialFinderIntake = {
    ...intake,
    normalized_condition: normalizedCondition,
    normalized_gene: normalizedGene,
  };

  const statuses = statusesFor(intake.recruiting_preference);

  // Gene-specific query (if known) + a broad condition query for broader options,
  // registries, and observational studies. Gates de-dupe the merged set.
  const queries: Promise<TrialRecord[]>[] = [
    fetchTrials({ condition: cond.ctgovCondition, statuses, pageSize: 50 }),
  ];
  if (geneKnown && normalizedGene) {
    queries.unshift(
      fetchTrials({
        condition: cond.ctgovCondition,
        term: normalizedGene,
        statuses,
        pageSize: 40,
      }),
    );
  }

  // Geocode the visitor's location (best-effort) in parallel with the trial fetch,
  // so we can rank by real distance and be honest about the requested radius.
  const locQuery = (intake.city || intake.postal_code || "").trim();
  const wantsDistance =
    intake.location_precision !== "none" &&
    !!intake.country &&
    !!locQuery &&
    (intake.travel_scope === "near_me" || intake.travel_scope === "state_region");
  const geoPromise: Promise<GeoPoint | null> = wantsDistance
    ? geocodeLocation(intake.country, locQuery)
    : Promise.resolve(null);

  let fetched: TrialRecord[] = [];
  let geo: GeoPoint | null = null;
  try {
    const [arrays, g] = await Promise.all([Promise.all(queries), geoPromise]);
    fetched = arrays.flat();
    geo = g;
  } catch {
    fetched = [];
  }

  const geneNote = geneKnown
    ? `Since you selected ${normalizedGene}, we prioritized studies that mention ${normalizedGene}, related inherited retinal disease terms, and currently active opportunities. Only the study team can confirm whether the full criteria fit your situation.`
    : "Because you don't know the gene linked to the diagnosis yet, we're showing broader RP/IRD studies, registries, and research opportunities that do not appear limited to one specific gene. Once you have a genetic test result, RP Hope can help surface more specific gene-related opportunities.";

  // Location honesty. `withinCount === undefined` = pre-ranking (empty paths).
  const radiusKm = intake.travel_radius_km ?? 160;
  // Show the mileage from the option the visitor actually picked (25/50/100/250).
  const radiusMiles = { 40: 25, 80: 50, 160: 100, 400: 250 }[radiusKm] ?? Math.round(radiusKm / 1.609);
  const locLabel = `${locQuery}${intake.country ? ", " + intake.country : ""}`;
  const locationSentence = (withinCount?: number): string => {
    if (intake.travel_scope !== "near_me" || !locQuery) return "";
    if (!geo)
      return `We couldn't pinpoint "${locQuery}" to sort by distance, so these results aren't distance-ranked — check each study's locations before reaching out.`;
    if (withinCount === undefined)
      return `We searched around ${locLabel} but didn't find active studies to rank by distance right now.`;
    if (withinCount > 0)
      return `${withinCount} of these ${withinCount === 1 ? "has a study site" : "have a study site"} within about ${radiusMiles} miles of ${locLabel}. The rest are farther away and shown because RP/IRD trials are rare — ask any study team about remote visits or travel support.`;
    return `We didn't find a study with a site within about ${radiusMiles} miles of ${locLabel}. RP and inherited-retinal-disease trials are rare and their sites are far apart, so we're showing the closest and broader options worth reviewing — it's worth asking any study team about remote visits or travel support.`;
  };
  const join = (loc: string) => [loc, geneNote].filter(Boolean).join(" ");

  // No-results paths still surface the context note (it must not be hidden); the
  // "couldn't find studies" explanation lives in the result UI.
  if (fetched.length === 0) {
    return NextResponse.json(
      emptyResponse(join(locationSentence()), geneKnown, normalizedGene, normalizedCondition),
    );
  }

  const gated = applySafetyGates(fetched, resolvedIntake).slice(0, MAX_CANDIDATES);

  if (gated.length === 0) {
    return NextResponse.json(
      emptyResponse(join(locationSentence()), geneKnown, normalizedGene, normalizedCondition),
    );
  }

  const classifications = await classifyTrials(gated, resolvedIntake);
  const byId = new Map(classifications.map((c) => [c.trial_id, c]));
  const pairs = gated
    .map((trial) => ({ trial, classification: byId.get(trial.id) }))
    .filter((p): p is { trial: TrialRecord; classification: NonNullable<typeof p.classification> } =>
      Boolean(p.classification),
    );

  const sections = rankAndGroup(pairs, resolvedIntake, geo);
  const allShown = [
    ...sections.bestMatches,
    ...sections.broaderOptions,
    ...sections.registriesObservational,
    ...sections.otherStudies,
  ];
  const totalShown = allShown.length;
  const withinCount = geo
    ? allShown.filter((s) => s.distanceKm != null && s.distanceKm <= radiusKm).length
    : undefined;

  const response: TrialMatchResponse = {
    sections,
    totalConsidered: fetched.length,
    totalShown,
    geneKnown,
    normalizedGene,
    normalizedCondition,
    contextNote: join(locationSentence(withinCount)),
    noResults: totalShown === 0,
  };

  return NextResponse.json(response);
}
