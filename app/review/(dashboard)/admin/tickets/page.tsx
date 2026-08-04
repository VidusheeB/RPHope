import type { Metadata } from "next";
import { requireAdmin } from "@/lib/reviewer/session";
import { getAdminOverview, getAllTicketsForAdmin } from "@/lib/reviewer/data";
import TicketInbox from "@/components/review/TicketInbox";

export const metadata: Metadata = { title: "Tickets | RP Hope Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  await requireAdmin();
  const [{ reviewers }, tickets] = await Promise.all([getAdminOverview(), getAllTicketsForAdmin()]);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-forest">Tickets</h1>
      <p className="mt-1 text-sm text-ink/60">Issues reviewers reported on gene drafts.</p>
      <div className="mt-6">
        <TicketInbox tickets={tickets} reviewers={reviewers} />
      </div>
    </div>
  );
}
