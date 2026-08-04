"use client";

import Link from "next/link";
import type { DashboardRow } from "@/lib/reviewer/data";
import { PUBLICATION_STATE_LABELS, type ReviewState } from "@/lib/reviewer/dashboardStatus";
import { reviewHref } from "@/lib/reviewer/paths";

// My Reviews — grouped by what the reviewer needs to DO next, per RP Hope
// Admin's spec (section 11): not a flat filterable table. Review state and
// publication state render as two separate badges — never merged into one
// "Published" label that hides in-progress review work.

const SECTIONS: { key: ReviewState; heading: string; primaryAction: string }[] = [
  { key: "assigned", heading: "Needs to be started", primaryAction: "Start review" },
  { key: "in_progress", heading: "In progress", primaryAction: "Continue review" },
  { key: "changes_requested", heading: "Changes requested", primaryAction: "Address changes" },
  { key: "submitted", heading: "Submitted", primaryAction: "View submission" },
  { key: "approved", heading: "Approved", primaryAction: "View" },
];

const REVIEW_BADGE_STYLE: Record<ReviewState, string> = {
  unassigned: "bg-ink/10 text-ink/70",
  assigned: "bg-ink/10 text-ink/70",
  in_progress: "bg-butter text-ink",
  submitted: "bg-mint text-forest",
  changes_requested: "bg-lilac text-ink",
  approved: "bg-mint text-forest",
};

const PUBLICATION_BADGE_STYLE: Record<string, string> = {
  draft: "bg-ink/5 text-ink/50",
  published: "bg-forest text-white",
  unpublished: "bg-maroon/15 text-maroon",
};

export default function DashboardList({ rows }: { rows: DashboardRow[] }) {
  const grouped = SECTIONS.map((s) => ({ ...s, rows: rows.filter((r) => r.reviewState === s.key) })).filter(
    (s) => s.rows.length > 0
  );

  if (rows.length === 0) {
    return (
      <p className="mt-6 rounded-lg border border-ink/10 bg-white p-6 text-ink/60">
        You do not currently have any assigned reviews.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {grouped.map((section) => (
        <section key={section.key}>
          <h2 className="font-display text-lg font-medium text-ink">
            {section.heading} <span className="text-sm font-normal text-ink/50">({section.rows.length})</span>
          </h2>
          <ul className="mt-3 space-y-3">
            {section.rows.map((r) => (
              <li key={r.draftId} className="rounded-lg border border-ink/12 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl font-medium text-ink">{r.geneSymbol}</h3>
                    <p className="text-sm text-ink/60">
                      {r.sentencesTotal > 0
                        ? `${r.sentencesVerified} of ${r.sentencesTotal} statements verified`
                        : `${r.unresolvedFlags} of ${r.flagCount} flag${r.flagCount === 1 ? "" : "s"} unresolved`}
                      {r.updatedAt ? ` · last activity ${new Date(r.updatedAt).toLocaleDateString()}` : ""}
                      {r.assignedAt ? ` · assigned ${new Date(r.assignedAt).toLocaleDateString()}` : ""}
                    </p>
                    {r.openTicketCount > 0 && (
                      <p className="mt-1 text-xs font-semibold text-maroon">
                        {r.blockingTicketCount > 0
                          ? `${r.blockingTicketCount} blocking issue${r.blockingTicketCount === 1 ? "" : "s"}`
                          : `${r.openTicketCount} open issue${r.openTicketCount === 1 ? "" : "s"}`}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${REVIEW_BADGE_STYLE[r.reviewState]}`}>
                      review: {r.reviewState.replace(/_/g, " ")}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PUBLICATION_BADGE_STYLE[r.publicationState]}`}>
                      {PUBLICATION_STATE_LABELS[r.publicationState]}
                    </span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <Link
                    href={reviewHref(`/${r.draftId}`)}
                    className="inline-block rounded bg-forest px-4 py-2 text-sm font-semibold text-white"
                  >
                    {section.primaryAction}
                  </Link>
                  {r.hasPublishedVersion && (
                    <a
                      href={`/genetic-insights/${r.geneSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-forest underline"
                    >
                      View live page
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
