import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireReviewer } from "@/lib/reviewer/session";
import { can } from "@/lib/reviewer/permissions";
import { reviewHref } from "@/lib/reviewer/paths";
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
  // Anyone with the full Genes console reaches their own assignments as the
  // "Assigned to me" TAB there, so this standalone page is a duplicate for
  // them — and worse, it was where sign-in landed, so an admin opened the
  // portal on a personal queue rather than Home. Reviewers have no console, so
  // for them this IS the page.
  const session = await requireReviewer();
  if (can(session.profile, "genes.review.all")) redirect(reviewHref("/admin"));

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
