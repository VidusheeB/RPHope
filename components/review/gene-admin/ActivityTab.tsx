import type { GeneAdminDetail } from "@/lib/reviewer/geneDetail";
import type { AuditLogRow } from "@/lib/reviewer/data";

const ACTION_LABELS: Record<string, string> = {
  draft_assigned: "assigned this gene",
  draft_reassigned: "reassigned this gene",
  draft_unassigned: "removed the assignment",
  flag_resolved: "resolved a review flag",
  sentence_verification_saved: "verified a statement",
  review_submitted: "submitted the review",
  changes_requested: "requested changes",
  review_approved: "approved the review",
  draft_published: "published this gene",
  gene_unpublished: "unpublished this gene",
  gene_version_restored: "restored a previous version into a new draft",
  ticket_created: "filed an issue",
  ticket_reply_added: "replied to an issue",
  ticket_updated: "updated an issue",
};

type TimelineEntry = { key: string; time: string; text: string };

export default function ActivityTab({
  detail,
  entries,
}: {
  detail: GeneAdminDetail;
  entries: (AuditLogRow & { actorName: string | null })[];
}) {
  const timeline: TimelineEntry[] = [];

  timeline.push({
    key: "generated",
    time: detail.content.generatedAt,
    text: "AI drafted this gene page.",
  });
  if (detail.firstOpenedAt && detail.activeAssignment) {
    timeline.push({
      key: "first-opened",
      time: detail.firstOpenedAt,
      text: `${detail.activeAssignment.reviewerName} opened the draft for the first time.`,
    });
  }
  for (const e of entries) {
    timeline.push({
      key: e.id,
      time: e.createdAt,
      text: `${e.actorName ?? "Someone"} ${ACTION_LABELS[e.action] ?? e.action.replace(/_/g, " ")}.`,
    });
  }

  timeline.sort((a, b) => (b.time > a.time ? 1 : -1));

  if (timeline.length === 0) {
    return <p className="rounded-lg border border-ink/10 bg-white p-4 text-sm text-ink/60">No activity recorded yet.</p>;
  }

  return (
    <ol className="space-y-2">
      {timeline.map((t) => (
        <li key={t.key} className="flex items-start justify-between gap-4 rounded-lg border border-ink/10 bg-white p-3 text-sm">
          <span className="text-ink/90">{t.text}</span>
          <span className="shrink-0 text-xs text-ink/50">{new Date(t.time).toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}
