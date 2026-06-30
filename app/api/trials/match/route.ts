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

  let fetched: TrialRecord[];
  try {
    fetched = (await Promise.all(queries)).flat();
  } catch {
    fetched = [];
  }

  const knownGeneNote = normalizedGene
    ? `Since you selected ${normalizedGene}, we prioritized studies that mention ${normalizedGene}, related inherited retinal disease terms, and currently active opportunities. Only the study team can confirm whether the full criteria fit your situation.`
    : "";
  const unknownGeneNote =
    "Because you don't know the gene linked to the diagnosis yet, we're showing broader RP/IRD studies, registries, and research opportunities that do not appear limited to one specific gene. Once you have a genetic test result, RP Hope can help surface more specific gene-related opportunities.";
  const contextNote = geneKnown ? knownGeneNote : unknownGeneNote;

  if (fetched.length === 0) {
    return NextResponse.json(
      emptyResponse(
        "We could not find relevant active studies from the available trial data right now. You may still want to check back later, join a registry, or discuss research options with your clinician.",
        geneKnown,
        normalizedGene,
        normalizedCondition,
      ),
    );
  }

  const gated = applySafetyGates(fetched, resolvedIntake).slice(0, MAX_CANDIDATES);

  if (gated.length === 0) {
    return NextResponse.json(
      emptyResponse(
        "We did not find a strong match in the active trial data right now. You may want to broaden your filters, join a registry, or check back later.",
        geneKnown,
        normalizedGene,
        normalizedCondition,
      ),
    );
  }

  const classifications = await classifyTrials(gated, resolvedIntake);
  const byId = new Map(classifications.map((c) => [c.trial_id, c]));
  const pairs = gated
    .map((trial) => ({ trial, classification: byId.get(trial.id) }))
    .filter((p): p is { trial: TrialRecord; classification: NonNullable<typeof p.classification> } =>
      Boolean(p.classification),
    );

  const sections = rankAndGroup(pairs, resolvedIntake);
  const totalShown =
    sections.bestMatches.length +
    sections.broaderOptions.length +
    sections.registriesObservational.length +
    sections.otherStudies.length;

  const response: TrialMatchResponse = {
    sections,
    totalConsidered: fetched.length,
    totalShown,
    geneKnown,
    normalizedGene,
    normalizedCondition,
    contextNote,
    noResults: totalShown === 0,
  };

  return NextResponse.json(response);
}
