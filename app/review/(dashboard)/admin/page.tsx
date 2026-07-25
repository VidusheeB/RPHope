import type { Metadata } from "next";
import { requireAdmin } from "@/lib/reviewer/session";
import { getAdminOverview, getAllTicketsForAdmin } from "@/lib/reviewer/data";
import AdminPanel from "@/components/review/AdminPanel";
import TicketInbox from "@/components/review/TicketInbox";

export const metadata: Metadata = { title: "Reviewer admin | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewAdminPage() {
  await requireAdmin(); // redirects non-admins to /review
  const [{ drafts, reviewers }, tickets] = await Promise.all([getAdminOverview(), getAllTicketsForAdmin()]);

  return (
    <div>
      <h1 className="font-display text-3xl font-medium text-forest">Reviewer administration</h1>
      <div className="mt-8">
        <AdminPanel reviewers={reviewers} drafts={drafts} />
      </div>
      <div className="mt-12">
        <h2 className="font-display text-2xl font-medium text-ink">Tickets</h2>
        <div className="mt-4">
          <TicketInbox tickets={tickets} reviewers={reviewers} />
        </div>
      </div>
    </div>
  );
}
