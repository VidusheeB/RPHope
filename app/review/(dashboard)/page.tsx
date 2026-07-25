import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getReviewerSession } from "@/lib/reviewer/session";
import { getAssignedDrafts } from "@/lib/reviewer/data";
import { reviewHref } from "@/lib/reviewer/paths";
import DashboardList from "@/components/review/DashboardList";

export const metadata: Metadata = { title: "Reviewer dashboard | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

// Admins land straight on the admin view instead of a separate personal
// queue — the admin view IS home for them. Non-admin reviewers keep this
// page as their personal "genes to review" queue.
export default async function ReviewDashboardPage() {
  const session = await getReviewerSession();
  if (session?.profile.role === "admin") redirect(reviewHref("/admin"));

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
