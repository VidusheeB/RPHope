"use client";

// Top-level Clinical Trials Finder: guided intake → live match → grouped results.

import { useState } from "react";
import type { TrialFinderIntake, TrialMatchResponse } from "@/lib/trials/types";
import TrialIntakeForm from "./TrialIntakeForm";
import TrialResults from "./TrialResults";

type Phase = "intake" | "loading" | "results" | "error";

export default function ClinicalTrialsFinder() {
  const [phase, setPhase] = useState<Phase>("intake");
  const [data, setData] = useState<TrialMatchResponse | null>(null);

  async function runMatch(intake: TrialFinderIntake) {
    setPhase("loading");
    try {
      const res = await fetch("/api/trials/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intake),
      });
      if (!res.ok) throw new Error("match failed");
      const json = (await res.json()) as TrialMatchResponse;
      setData(json);
      setPhase("results");
    } catch {
      setPhase("error");
    }
  }

  function restart() {
    setData(null);
    setPhase("intake");
  }

  if (phase === "loading") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center" aria-live="polite">
        <div
          className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-forest/20 border-t-forest motion-reduce:animate-none"
          aria-hidden="true"
        />
        <h2 className="mt-6 font-display text-2xl font-bold text-ink">
          Searching global trial registries…
        </h2>
        <p className="mt-2 text-ink/70">
          Pulling current studies and translating them into plain English. This
          takes a few seconds.
        </p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center">
        <h2 className="font-display text-2xl font-bold text-ink">
          Something went wrong searching for trials
        </h2>
        <p className="mt-2 text-ink/70">
          We couldn&rsquo;t reach the trial registry just now. Please try again in a
          moment, or browse ClinicalTrials.gov directly.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={restart}
            className="rounded-xl bg-forest px-6 py-3 font-bold text-white hover:bg-forest-dark"
          >
            Try again
          </button>
          <a
            href="https://clinicaltrials.gov/search?cond=retinitis+pigmentosa"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-ink/30 px-6 py-3 font-bold text-ink hover:bg-ink/5"
          >
            ClinicalTrials.gov ↗
          </a>
        </div>
      </div>
    );
  }

  if (phase === "results" && data) {
    return <TrialResults data={data} onRestart={restart} />;
  }

  return <TrialIntakeForm onSubmit={runMatch} />;
}
