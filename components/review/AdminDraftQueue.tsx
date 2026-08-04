"use client";

// Admin-eye view of every gene draft — review state and publication state
// render as two SEPARATE badges (never merged: a published gene with an
// active new draft under review must still show its real review progress,
// not just "Published"). Same gene-tile visual foundation as the
// reviewer's own DashboardList, extended with admin-only assign/reassign
// and take-down/republish controls.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { assignDraftAction, unpublishGeneAction } from "@/app/review/actions";
import type { AdminDraftRow } from "@/lib/reviewer/data";
import {
  REVIEW_STATE_LABELS,
  PUBLICATION_STATE_LABELS,
  type ReviewState,
  type PublicationState,
} from "@/lib/reviewer/dashboardStatus";
import { reviewHref } from "@/lib/reviewer/paths";

const REVIEW_BADGE_STYLE: Record<ReviewState, string> = {
  unassigned: "bg-ink/10 text-ink/70",
  assigned: "bg-ink/10 text-ink/70",
  in_progress: "bg-butter text-ink",
  submitted: "bg-mint text-forest",
  changes_requested: "bg-lilac text-ink",
  approved: "bg-mint text-forest",
};

const PUBLICATION_BADGE_STYLE: Record<PublicationState, string> = {
  draft: "bg-ink/5 text-ink/50",
  published: "bg-forest text-white",
  unpublished: "bg-maroon/15 text-maroon",
};

const TABS: { key: string; label: string; match: (d: AdminDraftRow) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "needs_assignment", label: "Needs assignment", match: (d) => d.reviewState === "unassigned" },
  { key: "assigned", label: "Assigned", match: (d) => d.reviewState === "assigned" },
  { key: "in_progress", label: "In progress", match: (d) => d.reviewState === "in_progress" },
  { key: "submitted", label: "Awaiting final review", match: (d) => d.reviewState === "submitted" },
  { key: "changes_requested", label: "Changes requested", match: (d) => d.reviewState === "changes_requested" },
  { key: "approved", label: "Approved", match: (d) => d.reviewState === "approved" },
  { key: "published", label: "Published", match: (d) => d.publicationState === "published" },
  { key: "unpublished", label: "Unpublished", match: (d) => d.publicationState === "unpublished" },
];

function primaryAction(d: AdminDraftRow): string {
  if (d.reviewState === "unassigned") return "Assign reviewer";
  if (d.reviewState === "submitted") return "Review submission";
  if (d.reviewState === "changes_requested") return "View requested changes";
  if (d.publicationState === "published") return "View live page";
  if (d.publicationState === "unpublished") return "Review and republish";
  if (d.reviewState === "approved") return "Preview and publish";
  return "Open assignment";
}

export default function AdminDraftQueue({
  drafts,
  reviewers,
}: {
  drafts: AdminDraftRow[];
  reviewers: { user_id: string; display_name: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [warning, setWarning] = useState<{ draftId: string; reviewerId: string; text: string } | null>(null);
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];
  const shown = drafts.filter(active.match);

  async function reassign(draftId: string, reviewerId: string, confirmed = false) {
    if (!reviewerId) return;
    const res = await assignDraftAction({ draftId, reviewerId, confirmed });
    setReassigning(null);
    if (!res.ok && res.data?.requiresConfirmation) {
      setWarning({ draftId, reviewerId, text: res.data.warning ?? "Reassign anyway?" });
      return;
    }
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setWarning(null);
    router.refresh();
  }

  async function takeDown(geneSlug: string) {
    if (!confirm(`Take the ${geneSlug.toUpperCase()} page down? Its published snapshot is preserved and it can be republished later.`)) return;
    const res = await unpublishGeneAction(geneSlug);
    if (!res.ok) alert(res.error);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter gene reviews">
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
            {t.label} ({drafts.filter(t.match).length})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 rounded-lg border border-ink/10 bg-white p-6 text-ink/60">
          No gene drafts in this view.
        </p>
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
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${REVIEW_BADGE_STYLE[d.reviewState]}`}>
                    {REVIEW_STATE_LABELS[d.reviewState]}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PUBLICATION_BADGE_STYLE[d.publicationState]}`}>
                    {PUBLICATION_STATE_LABELS[d.publicationState]}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Link href={reviewHref(`/admin/genes/${d.draftId}`)} className="rounded bg-forest px-4 py-2 text-sm font-semibold text-white">
                  {primaryAction(d)}
                </Link>
                {warning?.draftId === d.draftId ? (
                  <span className="flex flex-wrap items-center gap-2 rounded border border-gold/50 bg-butter/40 px-3 py-2 text-xs text-ink/80">
                    {warning.text}
                    <button
                      type="button"
                      onClick={() => reassign(warning.draftId, warning.reviewerId, true)}
                      className="rounded bg-forest px-2 py-1 font-semibold text-white"
                    >
                      Reassign anyway
                    </button>
                    <button type="button" onClick={() => setWarning(null)} className="rounded border border-ink/20 px-2 py-1">
                      Cancel
                    </button>
                  </span>
                ) : reassigning === d.draftId ? (
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
                {d.publicationState === "published" && (
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
