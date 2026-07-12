import type { Metadata } from "next";
import Link from "next/link";
import { requireReviewer } from "@/lib/reviewer/session";
import { getAssignedDrafts } from "@/lib/reviewer/data";
import DashboardList from "@/components/review/DashboardList";

export const metadata: Metadata = { title: "Reviewer dashboard | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewDashboardPage() {
  const session = await requireReviewer();
  const rows = await getAssignedDrafts();
  const totalUnresolved = rows.reduce((n, r) => n + r.unresolvedFlags, 0);

  return (
    <main className="min-h-screen bg-cream px-5 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium text-forest">Your reviews</h1>
            <p className="mt-1 text-sm text-ink/60">
              Signed in as {session.email}
              {session.profile.role === "admin" ? " · admin" : ""} ·{" "}
              {totalUnresolved} unresolved flag{totalUnresolved === 1 ? "" : "s"}
            </p>
          </div>
          {session.profile.role === "admin" ? (
            <Link href="/review/admin" className="text-sm font-semibold text-forest underline">
              Admin
            </Link>
          ) : null}
        </div>

        <div className="mt-8">
          <DashboardList rows={rows} />
        </div>
      </div>
    </main>
  );
}
