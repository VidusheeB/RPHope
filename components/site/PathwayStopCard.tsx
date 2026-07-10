// One stop on the RP Hope Journey timeline. Rendered inside an <ol> so screen
// readers convey stop order; the numbered node is decorative (aria-hidden).

import Link from "next/link";
import type { PathwayStop } from "@/lib/pathway";

export default function PathwayStopCard({
  stop,
  isLast,
}: {
  stop: PathwayStop;
  isLast: boolean;
}) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {/* Connector line + numbered node (decorative) */}
      <div className="flex flex-col items-center" aria-hidden="true">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full font-display text-lg font-medium ${
            stop.optional
              ? "border-2 border-forest/40 bg-cream text-forest"
              : "bg-forest text-white"
          }`}
        >
          {stop.order}
        </span>
        {!isLast && <span className="mt-1 w-0.5 flex-1 bg-forest/20" />}
      </div>

      <div className="flex-1 rounded-lg border border-ink/12 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-forest/70">
            {stop.optional ? "Optional stop" : `Stop ${stop.order}`}
          </p>
          {stop.label && (
            <span
              className={`rounded px-2.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide ${
                stop.label === "Start here"
                  ? "bg-gold/20 text-ink"
                  : "bg-forest/10 text-forest"
              }`}
            >
              {stop.label}
            </span>
          )}
        </div>

        <h3 className="mt-1.5 font-display text-xl font-medium text-ink">
          {stop.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink/75">
          {stop.description}
        </p>

        <Link
          href={stop.href}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-forest px-5 py-2.5 text-sm font-bold text-white transition hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/50 focus-visible:ring-offset-2"
        >
          {stop.cta}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </li>
  );
}
