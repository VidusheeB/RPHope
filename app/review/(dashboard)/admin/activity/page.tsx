import type { Metadata } from "next";
import { requireAdmin } from "@/lib/reviewer/session";
import { getRecentAuditLog } from "@/lib/reviewer/data";
import AuditLogView from "@/components/review/AuditLogView";

export const metadata: Metadata = { title: "Activity | RP Hope Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  await requireAdmin();
  const entries = await getRecentAuditLog();

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-forest">Activity</h1>
      <p className="mt-1 text-sm text-ink/60">
        Every significant reviewer/admin action — assignment, submission, approval, publishing, tickets.
      </p>
      <div className="mt-6">
        <AuditLogView entries={entries} />
      </div>
    </div>
  );
}
