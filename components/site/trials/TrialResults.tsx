// Renders grouped trial results with screen-reader-friendly counts, the
// known/unknown-gene context note, and the governance disclaimer.

import type { ScoredTrial, TrialMatchResponse } from "@/lib/trials/types";
import { DISCLAIMER } from "@/lib/trials/types";
import TrialCard from "./TrialCard";

function Section({
  title,
  blurb,
  items,
}: {
  title: string;
  blurb?: string;
  items: ScoredTrial[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-10" aria-label={`${title} (${items.length})`}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
        <span className="shrink-0 text-sm font-semibold text-forest">
          {items.length} {items.length === 1 ? "study" : "studies"}
        </span>
      </div>
      {blurb && <p className="mt-1 text-sm text-ink/65">{blurb}</p>}
      <div className="mt-5 grid gap-5">
        {items.map((it) => (
          <TrialCard key={it.trial.id} item={it} />
        ))}
      </div>
    </section>
  );
}

export default function TrialResults({
  data,
  onRestart,
}: {
  data: TrialMatchResponse;
  onRestart: () => void;
}) {
  const { sections } = data;
  const noStrong = sections.bestMatches.length === 0;

  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">
        Research you may want to review
      </h1>

      <p className="mt-2 text-sm text-ink/70" aria-live="polite">
        Showing <span className="font-semibold text-ink">{data.totalShown}</span>{" "}
        {data.totalShown === 1 ? "study" : "studies"} that may be relevant
        {data.normalizedCondition ? ` for ${data.normalizedCondition}` : ""}
        {data.geneKnown && data.normalizedGene ? ` and ${data.normalizedGene}` : ""}.
      </p>

      {/* Governance disclaimer — top of results */}
      <div className="mt-5 rounded-xl border border-gold/40 bg-butter/50 px-5 py-4 text-sm leading-relaxed text-ink/80">
        {DISCLAIMER}
      </div>

      {/* Known/unknown gene context — always shown (cannot be hidden), red box */}
      {data.contextNote && (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm leading-relaxed text-ink/80">
          {data.contextNote}
        </p>
      )}

      {data.noResults ? (
        <div className="mt-10 rounded-2xl border border-ink/10 bg-white p-8 text-center">
          <h2 className="font-display text-2xl font-bold text-ink">
            No strong matches found right now
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink/70">
            We could not find relevant active studies from the available trial data
            right now. You may still want to check back later, join a registry, or
            discuss research options with your clinician.
          </p>
          <a
            href="https://clinicaltrials.gov/search?cond=retinitis+pigmentosa"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-sm font-bold text-white hover:bg-forest-dark"
          >
            Browse ClinicalTrials.gov directly <span aria-hidden="true">↗</span>
          </a>
        </div>
      ) : (
        <>
          {noStrong && (
            <p className="mt-8 rounded-xl border border-ink/15 bg-white px-5 py-4 text-sm text-ink/75">
              We did not find a strong gene-specific match right now. Here are broader
              RP/IRD research options, registries, or studies that may still be worth
              reviewing.
            </p>
          )}
          <Section title="Best matches to review" items={sections.bestMatches} />
          <Section
            title="Broader research options"
            blurb="RP/IRD studies that aren't limited to one specific gene."
            items={sections.broaderOptions}
          />
          <Section
            title="Registries and observational studies"
            blurb="Often open to more people — useful while a gene result is pending."
            items={sections.registriesObservational}
          />
          <Section
            title="Other studies you may want to learn about"
            items={sections.otherStudies}
          />
        </>
      )}

      <div className="mt-12 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-xl border border-ink/30 px-6 py-3 font-bold text-ink hover:bg-ink/5"
        >
          ↺ Start a new search
        </button>
      </div>
    </div>
  );
}
