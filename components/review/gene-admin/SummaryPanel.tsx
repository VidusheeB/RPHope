import type { GeneAdminDetail } from "@/lib/reviewer/geneDetail";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 py-1">
      <dt className="text-ink/55">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

function fmt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString();
}

export default function SummaryPanel({ detail }: { detail: GeneAdminDetail }) {
  return (
    <div className="grid gap-6 rounded-lg border border-ink/10 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
      <dl>
        <Row label="Assigned reviewer" value={detail.activeAssignment?.reviewerName ?? "Unassigned"} />
        <Row label="Assigned by" value={detail.activeAssignment?.assignedByName} />
        <Row label="Assigned at" value={fmt(detail.activeAssignment?.assignedAt)} />
        <Row label="First opened" value={fmt(detail.firstOpenedAt)} />
        <Row label="Last activity" value={fmt(detail.lastActivityAt)} />
      </dl>
      <dl>
        <Row label="Submitted at" value={fmt(detail.submittedAt)} />
        <Row label="Submitted by" value={detail.submittedByName} />
        <Row label="Approved at" value={detail.reviewStatus === "approved" ? fmt(detail.approvedAt) : null} />
        <Row label="Approved by" value={detail.reviewStatus === "approved" ? detail.approvedByName : null} />
        <Row label="Published at" value={fmt(detail.currentPublishedVersion?.publishedAt)} />
        <Row label="Published by" value={detail.currentPublishedVersion?.approvedByName} />
        <Row label="Unpublished at" value={fmt(detail.mostRecentUnpublish?.unpublishedAt)} />
        <Row label="Unpublished by" value={detail.mostRecentUnpublish?.unpublishedByName} />
      </dl>
      <dl>
        <Row
          label="Verification progress"
          value={detail.sentencesTotal > 0 ? `${detail.sentencesVerified} of ${detail.sentencesTotal} statements` : "No statements to verify"}
        />
        <Row label="Unresolved flags" value={`${detail.unresolvedBlockingFlags} of ${detail.reviewFlags.length}`} />
        <Row
          label="Open tickets"
          value={
            detail.openTicketCount > 0
              ? `${detail.openTicketCount}${detail.blockingTicketCount > 0 ? ` (${detail.blockingTicketCount} blocking)` : ""}`
              : "None"
          }
        />
      </dl>
    </div>
  );
}
