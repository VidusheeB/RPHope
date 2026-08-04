"use client";

// The unified gene admin page's tab shell: Review / Preview / Activity /
// Versions / Tickets, all built on real data fetched once server-side (no
// placeholder panels). Review tab reuses the existing ReviewEditor
// wholesale — it already implements editing, citations, verification,
// flags, submit/approve/publish/unpublish/request-changes — rather than
// duplicating that logic here.

import { useState } from "react";
import type { GeneAdminDetail } from "@/lib/reviewer/geneDetail";
import type { AuditLogRow, TicketRow } from "@/lib/reviewer/data";
import type { Article } from "@/components/site/GeneArticles";
import ReviewEditor from "./ReviewEditor";
import SummaryPanel from "./gene-admin/SummaryPanel";
import PreviewTab from "./gene-admin/PreviewTab";
import ActivityTab from "./gene-admin/ActivityTab";
import VersionsTab from "./gene-admin/VersionsTab";
import TicketsTab from "./gene-admin/TicketsTab";
import { saveAdminNoteAction } from "@/app/review/actions";

const TABS = ["Review", "Preview", "Activity", "Versions", "Tickets"] as const;
type Tab = (typeof TABS)[number];

export default function GeneAdminWorkspace({
  detail,
  reviewers,
  activity,
  articles,
  adminCanPublish,
}: {
  detail: GeneAdminDetail;
  reviewers: { user_id: string; display_name: string }[];
  activity: (AuditLogRow & { actorName: string | null })[];
  articles: Article[];
  adminCanPublish: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Review");

  return (
    <div className="mt-6">
      <SummaryPanel detail={detail} />

      <FinalReviewBanner detail={detail} />

      <div className="mt-6 flex gap-1 border-b border-ink/10" role="tablist" aria-label="Gene sections">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-t-md px-4 py-2 text-sm font-semibold ${
              tab === t ? "border-b-2 border-forest text-forest" : "text-ink/60 hover:text-ink"
            }`}
          >
            {t}
            {t === "Tickets" && detail.openTicketCount > 0 ? ` (${detail.openTicketCount})` : ""}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "Review" && (
          <div className="space-y-6">
            <AdminNoteBox draftId={detail.draftId} initialNote={detail.adminNote} />
            <ReviewEditor
              draftId={detail.draftId}
              geneSlug={detail.geneSlug}
              geneSymbol={detail.geneSymbol}
              initialContent={detail.content}
              reviewFlags={detail.reviewFlags}
              initialResolutions={detail.resolutions}
              initialTickets={detail.tickets}
              reviewerCanPublish={adminCanPublish}
              isAdmin
              reviewStatus={detail.reviewStatus}
            />
          </div>
        )}
        {tab === "Preview" && (
          <PreviewTab
            draft={detail.content}
            geneSlug={detail.geneSlug}
            articles={articles}
            hasPublishedVersion={detail.publicationState === "published"}
          />
        )}
        {tab === "Activity" && <ActivityTab detail={detail} entries={activity} />}
        {tab === "Versions" && <VersionsTab versions={detail.versions} draftId={detail.draftId} />}
        {tab === "Tickets" && <TicketsTab tickets={detail.tickets} />}
      </div>
    </div>
  );
}

function FinalReviewBanner({ detail }: { detail: GeneAdminDetail }) {
  if (detail.reviewState !== "submitted") return null;
  return (
    <div className="mt-6 rounded-lg border border-mint bg-mint/30 p-4 text-sm text-ink/90">
      <p className="font-display text-base font-medium text-forest">Ready for final review</p>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        <li>Reviewer: {detail.activeAssignment?.reviewerName ?? "—"}</li>
        <li>Submitted: {detail.submittedAt ? new Date(detail.submittedAt).toLocaleString() : "—"}</li>
        <li>Verification: {detail.sentencesTotal > 0 ? `${detail.sentencesVerified}/${detail.sentencesTotal}` : "n/a"}</li>
        <li>Unresolved flags: {detail.unresolvedBlockingFlags}</li>
        <li>Open blocking tickets: {detail.blockingTicketCount}</li>
        <li>Existing public version: {detail.publicationState === "published" ? "Yes — publishing will replace it" : "No"}</li>
      </ul>
    </div>
  );
}

function AdminNoteBox({ draftId, initialNote }: { draftId: string; initialNote: string | null }) {
  const [note, setNote] = useState(initialNote ?? "");
  const [saved, setSaved] = useState(true);

  async function save() {
    await saveAdminNoteAction(draftId, note);
    setSaved(true);
  }

  return (
    <details className="rounded-lg border border-ink/10 bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold text-ink/70">
        Admin note {initialNote ? "(has content)" : "(empty)"}
      </summary>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setSaved(false);
        }}
        onBlur={save}
        rows={2}
        placeholder="Private note about this gene's review — never shown publicly or to reviewers."
        className="mt-2 w-full rounded border border-ink/15 p-2 text-sm"
      />
      {!saved && <p className="mt-1 text-xs text-ink/40">Unsaved — saves when you click away.</p>}
    </details>
  );
}
