import type { Metadata } from "next";
import { requireAdmin } from "@/lib/reviewer/session";
import { getAdminOverview } from "@/lib/reviewer/data";
import AdminPanel from "@/components/review/AdminPanel";

export const metadata: Metadata = { title: "Reviewer admin | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewAdminPage() {
  await requireAdmin(); // redirects non-admins to /review
  const { drafts, reviewers } = await getAdminOverview();

  return (
    <div>
      <h1 className="font-display text-3xl font-medium text-forest">Reviewer administration</h1>
      <div className="mt-8">
        <AdminPanel reviewers={reviewers} drafts={drafts} />
      </div>
    </div>
  );
}
