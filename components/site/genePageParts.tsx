// Shared presentational building blocks for the Genetic Insights gene page.
// Used by BOTH content shapes so every gene renders in one consistent format:
//   * the rich generated content (GenePageDraft, via GeneDraftView), and
//   * the legacy genesData.json content (via app/genetic-insights/[gene]/page.tsx).
// Presentational only — no data fetching. The collapsible sections are native
// <details> (keyboard- and screen-reader-native); ReadingModeToggle is the
// optional "Quick read / Full page" convenience layer over them.

import Link from "next/link";
import type { ReactNode } from "react";

/** The single constant content width every gene page uses (no wide→narrow jump). */
export const GENE_COL = "mx-auto max-w-[60rem]";
/** Comfortable reading measure for long prose inside a full-width section. */
export const PROSE = "max-w-[44rem] leading-relaxed text-ink/90";

export function GeneCrumb() {
  return (
    <Link
      href="/genetic-insights"
      className="text-sm font-bold uppercase tracking-[0.06em] text-forest hover:text-forest-dark"
    >
      ← Genetic Insights
    </Link>
  );
}

/** A labeled at-a-glance field (dt/dd). `sub` is an optional secondary line. */
export function GeneField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-b border-ink/10 py-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-forest">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{children}</dd>
    </div>
  );
}

/** Compact "Face of RP" badge. */
export function FaceOfRP({
  name,
  location,
  gene,
}: {
  name: string;
  location?: string;
  gene: string;
}) {
  const initial = name.replace(/[^A-Za-z]/g, "").charAt(0).toUpperCase() || "•";
  return (
    <div
      className="flex w-[7.5rem] shrink-0 flex-col items-center text-center"
      data-readable-key="face of rp"
      data-readable-text={`The face of RP for ${gene} is ${name}${
        location ? `, from ${location}` : ""
      }.`}
    >
      <span className="text-[0.62rem] font-bold uppercase tracking-widest text-forest/70">
        A Face of RP
      </span>
      <span
        aria-hidden="true"
        className="mt-2 grid h-24 w-24 place-items-center rounded-full border-[3px] border-gold-soft bg-forest font-display text-3xl font-medium text-white"
      >
        {initial}
      </span>
      <span className="mt-2 font-semibold text-ink">{name}</span>
      {location && <span className="text-sm text-ink/60">{location}</span>}
    </div>
  );
}

/**
 * The identity card: gene name, full name, an always-visible lead paragraph
 * (the essence — plain-English first, per CLAUDE.md), an optional Listen slot,
 * a Face of RP badge, and the at-a-glance grid.
 */
export function IdentityCard({
  gene,
  fullName,
  lead,
  listenSlot,
  face,
  glance,
}: {
  gene: string;
  fullName?: string;
  lead?: ReactNode;
  listenSlot?: ReactNode;
  face?: ReactNode;
  glance?: ReactNode;
}) {
  return (
    <section
      className="mt-4 rounded-2xl border border-ink/12 bg-white p-6 shadow-sm sm:p-8"
      aria-labelledby="gene-name"
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 id="gene-name" className="font-sans text-5xl font-bold tracking-tight text-ink">
            {gene}
          </h1>
          {fullName && <p className="mt-1 text-lg text-ink/60">{fullName}</p>}
          {lead && <p className={`mt-4 text-lg ${PROSE}`}>{lead}</p>}
          {listenSlot && <div className="mt-4">{listenSlot}</div>}
        </div>
        {face}
      </div>
      {glance && <dl className="mt-6 grid gap-x-10 border-t border-ink/10 pt-4 sm:grid-cols-2">{glance}</dl>}
    </section>
  );
}

/** Placeholder trial-status chips (see StatusTrials). */
function TrialChips() {
  const chips: { n: number; label: string; cls: string }[] = [
    { n: 1, label: "Recruiting", cls: "bg-mint text-forest-dark border-forest/25" },
    { n: 1, label: "Active, not recruiting", cls: "bg-butter text-[#7a5a12] border-[#7a5a12]/25" },
    { n: 0, label: "Completed", cls: "bg-cream-card text-ink/60 border-ink/12" },
    { n: 4, label: "Preclinical", cls: "bg-lilac text-[#4a3f7a] border-[#4a3f7a]/25" },
  ];
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="list" aria-label="Trial status (illustrative placeholder)">
        {chips.map((c) => (
          <span
            key={c.label}
            role="listitem"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${c.cls}`}
          >
            <span className="tabular-nums">{c.n}</span> {c.label}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs italic text-ink/50">
        Illustrative layout — live ClinicalTrials.gov counts are not wired to gene pages yet. Use
        Find clinical trials for current studies.
      </p>
    </div>
  );
}

/** Small status card wrapper ("Where things stand"). */
export function StatusCard({
  lead,
  title,
  children,
}: {
  lead: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ink/12 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.09em] text-gold">{lead}</p>
      <h2 className="mt-1 font-display text-xl font-medium text-ink">{title}</h2>
      <div className="mt-2 text-[0.95rem] text-ink/90">{children}</div>
    </div>
  );
}

/** The Clinical Trials status card with placeholder chips + Find-trials CTA. */
export function StatusTrials({
  geneSlug,
  summary,
}: {
  geneSlug: string;
  summary?: ReactNode;
}) {
  return (
    <StatusCard lead="Where things stand · Clinical trials" title="Studies that may be relevant to review">
      <TrialChips />
      {summary && <p className="mt-3">{summary}</p>}
      <Link
        href={`/clinical-trials?gene=${encodeURIComponent(geneSlug)}`}
        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2.5 text-[0.92rem] font-bold text-white hover:bg-forest-dark"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="h-4 w-4">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        Find clinical trials
      </Link>
      <span className="mt-2 block text-xs text-ink/50">
        Opens the Clinical Trials Finder with this gene — you can change or remove it.
      </span>
    </StatusCard>
  );
}

/**
 * A collapsible section. Native <details> so it is keyboard-operable and
 * announced as a disclosure by screen readers, with the heading kept as a real
 * <h2> for heading navigation. Collapsed by default (brief-first); ReadingModeToggle
 * can open/close all of them at once.
 */
export function GeneSection({
  title,
  preview,
  defaultOpen = false,
  children,
}: {
  title: string;
  preview?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="gene-sec overflow-hidden rounded-xl border border-ink/12 bg-white" open={defaultOpen}>
      <summary className="grid cursor-pointer grid-cols-[1fr_auto] items-start gap-x-4 gap-y-1 px-5 py-4 sm:px-6">
        <h2 className="col-start-1 font-display text-xl font-medium text-ink">{title}</h2>
        {preview && (
          <p className="gene-sec-preview col-start-1 mt-0.5 max-w-[42rem] text-[0.95rem] text-ink/60">
            {preview}
          </p>
        )}
        <span className="col-start-2 row-span-2 flex items-center gap-1.5 self-center whitespace-nowrap text-sm font-bold text-forest">
          <span className="gene-sec-more" />
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.4}
            aria-hidden="true"
            className="gene-sec-chev h-4 w-4 transition-transform"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>
      <div className="gene-sec-body px-5 pb-5 sm:px-6">{children}</div>
    </details>
  );
}

/** Footer metadata + medical disclaimer. */
export function GeneFooter({
  lastReviewed,
  reviewer,
}: {
  lastReviewed?: string;
  reviewer?: string;
}) {
  return (
    <div className="mt-10 border-t border-ink/10 pt-6">
      <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-ink/60">
        <span>
          <span className="font-bold text-ink">Last reviewed:</span>{" "}
          {lastReviewed || "not yet reviewed"}
        </span>
        <span>
          <span className="font-bold text-ink">Reviewer:</span> {reviewer || "—"}
        </span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-ink/50">
        <span className="font-semibold text-ink/70">Medical disclaimer:</span> This page is for
        education and navigation only — not medical advice, diagnosis, or treatment. These summaries
        are paraphrases of published research; always confirm details with a qualified clinician and
        primary sources.
      </p>
    </div>
  );
}
