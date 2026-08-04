import type { Metadata } from "next";
import { requireAdmin } from "@/lib/reviewer/session";
import { getAdminOverview, getAdminDraftQueue } from "@/lib/reviewer/data";
import AdminDraftQueue from "@/components/review/AdminDraftQueue";

export const metadata: Metadata = { title: "Gene Reviews | RP Hope Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function GeneReviewsPage() {
  await requireAdmin();
  const [{ reviewers }, draftQueue] = await Promise.all([getAdminOverview(), getAdminDraftQueue()]);

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-forest">Gene Reviews</h1>
      <p className="mt-1 text-sm text-ink/60">Every gene draft — assignment, review progress, and publication.</p>
      <div className="mt-6">
        <AdminDraftQueue drafts={draftQueue} reviewers={reviewers.filter((r) => r.active)} />
      </div>
    </div>
  );
}
