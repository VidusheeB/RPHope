import type { Metadata } from "next";
import { getAssignedDrafts } from "@/lib/reviewer/data";
import DashboardList from "@/components/review/DashboardList";

export const metadata: Metadata = { title: "Reviewer dashboard | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewDashboardPage() {
  const rows = await getAssignedDrafts();
  const totalUnresolved = rows.reduce((n, r) => n + r.unresolvedFlags, 0);

  return (
    <div>
      <h1 className="font-display text-3xl font-medium text-forest">Your reviews</h1>
      <p className="mt-1 text-sm text-ink/60">
        {totalUnresolved} unresolved flag{totalUnresolved === 1 ? "" : "s"} across your assigned genes
      </p>

      <div className="mt-8">
        <DashboardList rows={rows} />
      </div>
    </div>
  );
}
