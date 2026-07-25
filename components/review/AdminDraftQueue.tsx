"use client";

// Admin-eye view of every draft: Review queue (unassigned/assigned/in
// review/changes requested) / Submitted reviews / Published — same
// gene-tile visual foundation as the reviewer's own DashboardList, extended
// with the assignee and admin-only reassign control.

import { useState } from "react";
import Link from "next/link";
import { assignDraftAction, unpublishGeneAction } from "@/app/review/actions";
import { useRouter } from "next/navigation";
import type { AdminDraftRow } from "@/lib/reviewer/data";
import type { DashboardStatus } from "@/lib/reviewer/dashboardStatus";
import { reviewHref } from "@/lib/reviewer/paths";

const STATUS_STYLE: Record<DashboardStatus, string> = {
  Unassigned: "bg-ink/10 text-ink/70",
  Assigned: "bg-ink/10 text-ink/70",
  "In review": "bg-butter text-ink",
  "Submitted for approval": "bg-mint text-forest",
  Published: "bg-forest text-white",
  "Changes requested": "bg-lilac text-ink",
  Blocked: "bg-maroon/15 text-maroon",
};

const TABS: { key: string; label: string; match: (s: DashboardStatus) => boolean }[] = [
  {
    key: "queue",
    label: "Review queue",
    match: (s) => s === "Unassigned" || s === "Assigned" || s === "In review" || s === "Changes requested" || s === "Blocked",
  },
  { key: "submitted", label: "Submitted reviews", match: (s) => s === "Submitted for approval" },
  { key: "published", label: "Published", match: (s) => s === "Published" },
];

export default function AdminDraftQueue({
  drafts,
  reviewers,
}: {
  drafts: AdminDraftRow[];
  reviewers: { user_id: string; display_name: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState("queue");
  const [reassigning, setReassigning] = useState<string | null>(null);
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const shown = drafts.filter((d) => active.match(d.status));

  async function reassign(draftId: string, reviewerId: string) {
    if (!reviewerId) return;
    await assignDraftAction({ draftId, reviewerId });
    setReassigning(null);
    router.refresh();
  }

  async function takeDown(geneSlug: string) {
    if (!confirm(`Take the ${geneSlug.toUpperCase()} page down? It'll fall back to the legacy content until republished.`)) return;
    const res = await unpublishGeneAction(geneSlug);
    if (!res.ok) alert(res.error);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter drafts">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1 text-sm ${
              tab === t.key ? "bg-forest text-white" : "bg-white text-ink/80 border border-ink/15"
            }`}
          >
            {t.label} ({drafts.filter((d) => t.match(d.status)).length})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 text-ink/60">No drafts in this view.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {shown.map((d) => (
            <li key={d.draftId} className="rounded-lg border border-ink/12 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-medium text-ink">{d.geneSymbol}</h3>
                  <p className="text-sm text-ink/60">
                    {d.assignedReviewerName ? `Assigned to ${d.assignedReviewerName}` : "Unassigned"}
                    {d.sentencesTotal > 0 ? ` · ${d.sentencesVerified}/${d.sentencesTotal} verified` : ""}
                    {d.blockingTicketCount > 0 ? ` · ${d.blockingTicketCount} blocking issue(s)` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[d.status]}`}>
                  {d.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link href={reviewHref(`/${d.draftId}`)} className="rounded bg-forest px-4 py-2 text-sm font-semibold text-white">
                  Open as admin
                </Link>
                {reassigning === d.draftId ? (
                  <select
                    autoFocus
                    defaultValue=""
                    onChange={(e) => reassign(d.draftId, e.target.value)}
                    onBlur={() => setReassigning(null)}
                    className="rounded border border-ink/20 px-2 py-1 text-sm"
                  >
                    <option value="" disabled>
                      Choose reviewer…
                    </option>
                    {reviewers.map((r) => (
                      <option key={r.user_id} value={r.user_id}>
                        {r.display_name || r.user_id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReassigning(d.draftId)}
                    className="text-sm font-semibold text-forest underline"
                  >
                    {d.assignedReviewerName ? "Reassign" : "Assign"}
                  </button>
                )}
                {d.status === "Published" && (
                  <button
                    type="button"
                    onClick={() => takeDown(d.geneSlug)}
                    className="text-sm font-semibold text-maroon underline"
                  >
                    Take down
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
