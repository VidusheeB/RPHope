import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/reviewer/session";
import { getAdminDraftQueue, getAllTicketsForAdmin, getRecentAuditLog } from "@/lib/reviewer/data";
import { reviewHref } from "@/lib/reviewer/paths";

export const metadata: Metadata = { title: "Overview | RP Hope Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  reviewer_invited: "invited a reviewer",
  reviewer_activated: "reactivated a reviewer",
  reviewer_deactivated: "deactivated a reviewer",
  draft_assigned: "assigned",
  draft_reassigned: "reassigned",
  draft_unassigned: "unassigned",
  review_submitted: "submitted",
  changes_requested: "requested changes on",
  review_approved: "approved",
  draft_published: "published",
  gene_unpublished: "unpublished",
  ticket_created: "filed a ticket on",
  ticket_reply_added: "replied to a ticket on",
  ticket_updated: "updated a ticket on",
};

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [genes, tickets, audit] = await Promise.all([
    getAdminDraftQueue(),
    getAllTicketsForAdmin(),
    getRecentAuditLog(30),
  ]);

  const needsAssignment = genes.filter((g) => g.reviewState === "unassigned");
  const inReview = genes.filter((g) => g.reviewState === "assigned" || g.reviewState === "in_progress");
  const awaitingFinalReview = genes.filter((g) => g.reviewState === "submitted");
  const published = genes.filter((g) => g.publicationState === "published");
  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "in_progress");

  type Attention = { key: string; text: string; time: string; href: string; action: string };
  const attention: Attention[] = [
    ...awaitingFinalReview.map((g) => ({
      key: `submitted-${g.draftId}`,
      text: `${g.geneSymbol} was submitted for final review${g.assignedReviewerName ? ` by ${g.assignedReviewerName}` : ""}.`,
      time: g.updatedAt ?? "",
      href: reviewHref(`/${g.draftId}`),
      action: "Review submission",
    })),
    ...genes
      .filter((g) => g.blockingTicketCount > 0)
      .map((g) => ({
        key: `blocking-${g.draftId}`,
        text: `${g.geneSymbol} has ${g.blockingTicketCount} blocking issue${g.blockingTicketCount === 1 ? "" : "s"} open.`,
        time: g.updatedAt ?? "",
        href: reviewHref(`/${g.draftId}`),
        action: "View issue",
      })),
    ...needsAssignment.map((g) => ({
      key: `unassigned-${g.draftId}`,
      text: `${g.geneSymbol} has not been assigned.`,
      time: "",
      href: reviewHref("/admin/genes"),
      action: "Assign reviewer",
    })),
  ]
    .sort((a, b) => (b.time > a.time ? 1 : -1))
    .slice(0, 12);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-forest">Overview</h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="Needs assignment" value={needsAssignment.length} href={reviewHref("/admin/genes")} />
        <SummaryCard label="In review" value={inReview.length} href={reviewHref("/admin/genes")} />
        <SummaryCard label="Awaiting final review" value={awaitingFinalReview.length} href={reviewHref("/admin/genes")} />
        <SummaryCard label="Published genes" value={published.length} href={reviewHref("/admin/genes")} />
        <SummaryCard label="Open tickets" value={openTickets.length} href={reviewHref("/admin/tickets")} />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-lg font-medium text-ink">Needs your attention</h2>
          {attention.length === 0 ? (
            <p className="mt-3 rounded-lg border border-ink/10 bg-white p-4 text-sm text-ink/60">
              Nothing needs attention right now.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {attention.map((a) => (
                <li key={a.key} className="flex items-center justify-between gap-3 rounded-lg border border-ink/10 bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink/90">{a.text}</p>
                    {a.time && <p className="text-xs text-ink/50">{new Date(a.time).toLocaleString()}</p>}
                  </div>
                  <Link href={a.href} className="shrink-0 rounded bg-forest px-3 py-1.5 text-xs font-semibold text-white">
                    {a.action}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-display text-lg font-medium text-ink">Recent activity</h2>
          {audit.length === 0 ? (
            <p className="mt-3 rounded-lg border border-ink/10 bg-white p-4 text-sm text-ink/60">
              No recorded actions yet.
            </p>
          ) : (
            <ul className="mt-3 max-h-[28rem] space-y-1.5 overflow-y-auto rounded-lg border border-ink/10 bg-white p-3">
              {audit.map((e) => (
                <li key={e.id} className="border-b border-ink/5 py-1.5 text-sm text-ink/80 last:border-0">
                  {ACTION_LABELS[e.action] ?? e.action.replace(/_/g, " ")}
                  <span className="ml-2 text-xs text-ink/40">{new Date(e.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-ink/10 bg-white p-4 transition hover:border-forest/40">
      <p className="font-display text-2xl font-medium text-ink">{value}</p>
      <p className="text-xs text-ink/60">{label}</p>
    </Link>
  );
}
