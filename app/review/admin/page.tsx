import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/reviewer/session";
import { getAdminOverview } from "@/lib/reviewer/data";
import AdminPanel from "@/components/review/AdminPanel";

export const metadata: Metadata = { title: "Reviewer admin | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewAdminPage() {
  await requireAdmin(); // redirects non-admins to /review
  const { drafts, reviewers } = await getAdminOverview();

  return (
    <main className="min-h-screen bg-cream px-5 py-12">
      <div className="mx-auto max-w-3xl">
        <Link href="/review" className="text-sm font-semibold text-forest underline">
          ← Dashboard
        </Link>
        <h1 className="mt-3 font-display text-3xl font-medium text-forest">Reviewer administration</h1>
        <div className="mt-8">
          <AdminPanel reviewers={reviewers} drafts={drafts} />
        </div>
      </div>
    </main>
  );
}
