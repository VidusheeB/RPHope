import type { Metadata } from "next";
import { requireAdmin } from "@/lib/reviewer/session";
import { getAdminOverview, getAdminDraftQueue, getAllTicketsForAdmin, getRecentAuditLog } from "@/lib/reviewer/data";
import AdminPanel from "@/components/review/AdminPanel";
import AdminDraftQueue from "@/components/review/AdminDraftQueue";
import TicketInbox from "@/components/review/TicketInbox";
import AuditLogView from "@/components/review/AuditLogView";

export const metadata: Metadata = { title: "Reviewer admin | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewAdminPage() {
  await requireAdmin(); // redirects non-admins to /review
  const [{ reviewers }, draftQueue, tickets, auditLog] = await Promise.all([
    getAdminOverview(),
    getAdminDraftQueue(),
    getAllTicketsForAdmin(),
    getRecentAuditLog(),
  ]);

  return (
    <div>
      <h1 className="font-display text-3xl font-medium text-forest">Reviewer administration</h1>

      <div className="mt-8">
        <h2 className="font-display text-2xl font-medium text-ink">Drafts</h2>
        <div className="mt-4">
          <AdminDraftQueue drafts={draftQueue} reviewers={reviewers} />
        </div>
      </div>

      <div className="mt-12">
        <h2 className="font-display text-2xl font-medium text-ink">Tickets</h2>
        <div className="mt-4">
          <TicketInbox tickets={tickets} reviewers={reviewers} />
        </div>
      </div>

      <div className="mt-12">
        <AdminPanel reviewers={reviewers} />
      </div>

      <div className="mt-12">
        <h2 className="font-display text-2xl font-medium text-ink">Audit trail</h2>
        <div className="mt-4">
          <AuditLogView entries={auditLog} />
        </div>
      </div>
    </div>
  );
}
