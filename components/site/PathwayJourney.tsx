// "Your RP Hope Journey" — the result of the My RP Pathway quiz, rendered as a
// guided timeline (primary path) plus optional next stops. A navigation tool, not
// medical advice; copy stays site-focused ("Start here", "next stop"), never a
// recommendation/treatment claim.

import type { PathwayResult } from "@/lib/pathway";
import PathwayStopCard from "./PathwayStopCard";

export default function PathwayJourney({
  result,
  onRestart,
}: {
  result: PathwayResult;
  onRestart: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <p className="text-sm font-bold uppercase tracking-widest text-forest">
        My RP Pathway
      </p>
      <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">
        {result.title}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink/75">{result.subtitle}</p>
      <p className="mt-2 text-sm text-ink/60">
        Your journey stays saved while this tab is open — open a stop, then return
        here from the <span className="font-semibold">My RP Pathway</span> menu
        anytime.
      </p>

      {/* Governance note */}
      <div className="mt-6 rounded-xl border border-gold/40 bg-butter/50 px-5 py-4 text-sm leading-relaxed text-ink/80">
        This is a guided tour of the RP Hope website built from your answers — a
        navigation aid for education only, <span className="font-semibold">not
        medical advice</span>, diagnosis, or treatment recommendations.
      </div>

      {/* Primary path */}
      <section className="mt-10" aria-label="Your guided path">
        <h2 className="font-display text-2xl font-bold text-ink">Your path</h2>
        <ol className="mt-5">
          {result.primaryPath.map((stop, i) => (
            <PathwayStopCard
              key={stop.id}
              stop={stop}
              isLast={i === result.primaryPath.length - 1}
            />
          ))}
        </ol>
      </section>

      {/* Optional next stops */}
      {result.optionalStops.length > 0 && (
        <section className="mt-8" aria-label="Optional next stops">
          <h2 className="font-display text-2xl font-bold text-ink">
            Optional next stops
          </h2>
          <p className="mt-1 text-sm text-ink/65">
            Not part of the main path, but they may be useful.
          </p>
          <ol className="mt-5">
            {result.optionalStops.map((stop, i) => (
              <PathwayStopCard
                key={stop.id}
                stop={stop}
                isLast={i === result.optionalStops.length - 1}
              />
            ))}
          </ol>
        </section>
      )}

      {/* Notes */}
      {result.notes && result.notes.length > 0 && (
        <ul className="mt-8 space-y-2">
          {result.notes.map((n, i) => (
            <li
              key={i}
              className="rounded-xl border border-forest/20 bg-mint/30 px-5 py-3 text-sm leading-relaxed text-ink/80"
            >
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-12 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={onRestart}
          className="rounded-xl border border-ink/30 px-6 py-3 font-bold text-ink hover:bg-ink/5"
        >
          ↺ Rebuild my pathway
        </button>
      </div>
    </div>
  );
}
