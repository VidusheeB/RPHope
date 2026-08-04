import type { Metadata } from "next";
import { requireAdmin } from "@/lib/reviewer/session";
import { getAdminOverview } from "@/lib/reviewer/data";
import AdminPanel from "@/components/review/AdminPanel";

export const metadata: Metadata = { title: "Reviewers | RP Hope Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewersPage() {
  await requireAdmin();
  const { reviewers, drafts } = await getAdminOverview();

  const active = reviewers.filter((r) => r.active).length;
  const inactive = reviewers.filter((r) => !r.active).length;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-forest">Reviewers</h1>
          <p className="mt-1 text-sm text-ink/60">Invite, manage, and assign work to reviewers and admins.</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCount label="Active reviewers" value={active} />
        <SummaryCount label="Inactive" value={inactive} />
        <SummaryCount label="Total accounts" value={reviewers.length} />
        <SummaryCount label="Genes in system" value={drafts.length} />
      </div>

      <div className="mt-8">
        <AdminPanel reviewers={reviewers} />
      </div>
    </div>
  );
}

function SummaryCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-ink/10 bg-white p-4">
      <p className="font-display text-2xl font-medium text-ink">{value}</p>
      <p className="text-xs text-ink/60">{label}</p>
    </div>
  );
}
