import type { Metadata } from "next";
import { getAssignedDrafts } from "@/lib/reviewer/data";
import DashboardList from "@/components/review/DashboardList";

export const metadata: Metadata = { title: "Reviewer dashboard | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

// Personal queue — every user's own assignments, admins included. An admin
// can assign a gene to themselves and then reviews it exactly as a reviewer
// would, so this is reachable from "Assigned to me" for BOTH roles. It was
// briefly hidden from admins behind a hideIf on genes.review.all, which left
// them able to self-assign with nowhere to see the result.
export default async function ReviewDashboardPage() {
  const rows = await getAssignedDrafts();
  const totalUnresolved = rows.reduce((n, r) => n + r.unresolvedFlags, 0);

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-forest">Assigned to me</h1>
      <p className="mt-1 text-sm text-ink/60">
        {totalUnresolved} unresolved flag{totalUnresolved === 1 ? "" : "s"} across your assigned genes
      </p>

      <div className="mt-8">
        <DashboardList rows={rows} />
      </div>
    </div>
  );
}
