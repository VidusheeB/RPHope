import type { Metadata } from "next";
import { getAssignedDrafts } from "@/lib/reviewer/data";
import DashboardList from "@/components/review/DashboardList";

export const metadata: Metadata = { title: "Reviewer dashboard | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

// Personal "genes to review" queue — every user's own assignments,
// including an admin's (admins land on /admin as their main "Dashboard",
// but still need somewhere to see drafts they've assigned to themselves;
// this is reachable via the "My reviews" nav link).
export default async function ReviewDashboardPage() {
  const rows = await getAssignedDrafts();
  const totalUnresolved = rows.reduce((n, r) => n + r.unresolvedFlags, 0);

  return (
    <div>
      <h1 className="font-display text-3xl font-medium text-forest">Genes to review</h1>
      <p className="mt-1 text-sm text-ink/60">
        {totalUnresolved} unresolved flag{totalUnresolved === 1 ? "" : "s"} across your assigned genes
      </p>

      <div className="mt-8">
        <DashboardList rows={rows} />
      </div>
    </div>
  );
}
