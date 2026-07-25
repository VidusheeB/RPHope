"use client";

import { useState } from "react";
import Link from "next/link";
import type { DashboardRow } from "@/lib/reviewer/data";
import type { DashboardStatus } from "@/lib/reviewer/dashboardStatus";

const FILTERS: { key: string; label: string; match: (s: DashboardStatus) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "assigned", label: "Assigned", match: (s) => s === "Assigned" },
  { key: "in_progress", label: "In progress", match: (s) => s === "In review" },
  { key: "changes_requested", label: "Changes requested", match: (s) => s === "Changes requested" },
  { key: "submitted", label: "Submitted", match: (s) => s === "Submitted for approval" },
  { key: "published", label: "Published", match: (s) => s === "Published" },
];

const STATUS_STYLE: Record<DashboardStatus, string> = {
  Unassigned: "bg-ink/10 text-ink/70",
  Assigned: "bg-ink/10 text-ink/70",
  "In review": "bg-butter text-ink",
  "Submitted for approval": "bg-mint text-forest",
  Published: "bg-forest text-white",
  "Changes requested": "bg-lilac text-ink",
  Blocked: "bg-maroon/15 text-maroon",
};

export default function DashboardList({ rows }: { rows: DashboardRow[] }) {
  const [filter, setFilter] = useState("all");
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const shown = rows.filter((r) => active.match(r.status));

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter drafts">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-sm ${
              filter === f.key ? "bg-forest text-white" : "bg-white text-ink/80 border border-ink/15"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-ink/60">No drafts in this view.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {shown.map((r) => (
            <li key={r.draftId} className="rounded-lg border border-ink/12 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl font-medium text-ink">{r.geneSymbol}</h2>
                  <p className="text-sm text-ink/60">
                    {r.sentencesTotal > 0
                      ? `${r.sentencesVerified} of ${r.sentencesTotal} statements verified`
                      : `${r.unresolvedFlags} of ${r.flagCount} flag${r.flagCount === 1 ? "" : "s"} unresolved`}
                    {r.updatedAt ? ` · last saved ${new Date(r.updatedAt).toLocaleDateString()}` : ""}
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
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[r.status]}`}>
                  {r.status}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Link
                  href={`/review/${r.draftId}`}
                  className="inline-block rounded bg-forest px-4 py-2 text-sm font-semibold text-white"
                >
                  {r.status === "Published" ? "View" : "Open review"}
                </Link>
                {r.hasPublishedVersion && r.status !== "Published" && (
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
      )}
    </div>
  );
}
