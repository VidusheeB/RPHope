// One trial/research opportunity, framed as "may be relevant to review."
// Never states eligibility. Status is conveyed with text + shape, never color alone.

import type { ScoredTrial } from "@/lib/trials/types";
import { RELEVANCE_LABELS } from "@/lib/trials/types";

function statusBadge(status: string): { label: string; cls: string } {
  const s = status.toUpperCase();
  if (s === "RECRUITING")
    return { label: "Recruiting", cls: "bg-mint text-forest border-forest/30" };
  if (s === "NOT_YET_RECRUITING")
    return { label: "Not yet recruiting", cls: "bg-butter text-ink border-gold/40" };
  if (s === "ENROLLING_BY_INVITATION")
    return { label: "Enrolling by invitation", cls: "bg-butter text-ink border-gold/40" };
  if (s === "ACTIVE_NOT_RECRUITING")
    return { label: "Active, not recruiting", cls: "bg-lilac text-ink border-ink/20" };
  if (s === "COMPLETED")
    return { label: "Completed", cls: "bg-ink/5 text-ink/70 border-ink/20" };
  if (s === "TERMINATED" || s === "WITHDRAWN" || s === "SUSPENDED")
    return { label: s.charAt(0) + s.slice(1).toLowerCase(), cls: "bg-ink/5 text-ink/70 border-ink/20" };
  return {
    label: status.replace(/_/g, " ").toLowerCase(),
    cls: "bg-ink/5 text-ink/70 border-ink/20",
  };
}

const STUDY_TYPE_LABEL: Record<string, string> = {
  interventional: "Treatment / interventional",
  observational: "Observational study",
  registry: "Patient registry",
  screening: "Screening study",
  unknown: "Research study",
};

export default function TrialCard({ item }: { item: ScoredTrial }) {
  const { trial, classification } = item;
  const badge = statusBadge(trial.status);
  const matchLabel = RELEVANCE_LABELS[classification.relevance_category];
  const primaryCountries = trial.countries.slice(0, 4).join(", ");
  const moreCountries = trial.countries.length > 4 ? ` +${trial.countries.length - 4} more` : "";
  const nearestMiles =
    item.distanceKm != null ? Math.round(item.distanceKm / 1.609) : undefined;

  return (
    <article className="rounded-2xl border border-ink/10 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${badge.cls}`}
        >
          <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-current" />
          {badge.label}
        </span>
        <span className="rounded-full border border-forest/30 bg-forest/5 px-3 py-1 text-xs font-bold text-forest">
          {matchLabel}
        </span>
        {trial.study_type && (
          <span className="rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/70">
            {STUDY_TYPE_LABEL[trial.study_type] || "Research study"}
          </span>
        )}
        {trial.phase && (
          <span className="rounded-full border border-ink/15 px-3 py-1 text-xs font-semibold text-ink/70">
            {trial.phase.replace(/_/g, " ").toLowerCase()}
          </span>
        )}
      </div>

      <h3 className="mt-3 font-display text-xl font-bold leading-snug text-ink">
        {trial.title}
      </h3>

      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="font-semibold text-forest">Location</dt>
          <dd className="text-ink/80">
            {primaryCountries || "Not specified"}
            {moreCountries}
            {nearestMiles != null && (
              <span className="text-ink/60">
                {" "}
                · nearest site ~{nearestMiles.toLocaleString()} mi
              </span>
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold text-forest">Relevance</dt>
          <dd className="text-ink/80">
            {trial.genes.length
              ? trial.genes.slice(0, 4).join(", ")
              : trial.conditions[0] || "Inherited retinal disease"}
          </dd>
        </div>
      </dl>

      {trial.brief_summary && (
        <p className="mt-4 text-sm leading-relaxed text-ink/75">
          {trial.brief_summary.length > 320
            ? trial.brief_summary.slice(0, 320).trimEnd() + "…"
            : trial.brief_summary}
        </p>
      )}

      <div className="mt-4 rounded-xl border border-forest/15 bg-cream/60 p-4">
        <p className="text-sm font-bold text-forest">Why this may be relevant</p>
        <p className="mt-1 text-sm leading-relaxed text-ink/80">
          {classification.plain_english_reason}
        </p>
        {classification.matched_factors.length > 0 && (
          <p className="mt-2 text-xs text-ink/60">
            <span className="font-semibold">Lined up:</span>{" "}
            {classification.matched_factors.join(" · ")}
          </p>
        )}
      </div>

      {classification.study_team_questions.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-bold text-ink">What to ask the study team</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink/75">
            {classification.study_team_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {classification.missing_information.length > 0 && (
        <p className="mt-3 text-xs text-ink/60">
          <span className="font-semibold">Still needed:</span>{" "}
          {classification.missing_information.join(", ")}.
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <a
          href={trial.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-sm font-bold text-white hover:bg-forest-dark"
        >
          View official trial record
          <span aria-hidden="true">↗</span>
          <span className="sr-only">(opens ClinicalTrials.gov in a new tab)</span>
        </a>
        <span className="text-xs text-ink/55">{trial.id} · ClinicalTrials.gov</span>
      </div>

      <p className="mt-4 border-t border-ink/10 pt-3 text-xs leading-relaxed text-ink/55">
        This is an option to review, not an eligibility decision. Only the study team
        or a qualified clinician can confirm whether this study is appropriate for a
        specific person.
      </p>
    </article>
  );
}
