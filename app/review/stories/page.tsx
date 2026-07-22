import type { Metadata } from "next";
import Link from "next/link";
import { requireReviewer } from "@/lib/reviewer/session";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

export const metadata: Metadata = { title: "Story submissions | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  full_name: string;
  display_name: string;
  edit_permission: "review_first" | "free_edit";
  status: "pending_review" | "published" | "rejected";
  created_at: string;
};

export default async function ReviewStoriesPage() {
  await requireReviewer();
  const service = getServiceSupabase();
  const rows: Row[] = service
    ? ((
        await service
          .from("story_submissions")
          .select("id, full_name, display_name, edit_permission, status, created_at")
          .order("created_at", { ascending: false })
          .limit(100)
      ).data as Row[] | null) ?? []
    : [];

  const pending = rows.filter((r) => r.status === "pending_review");
  const actioned = rows.filter((r) => r.status !== "pending_review");

  return (
    <main className="min-h-screen bg-cream px-5 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-medium text-forest">
            Story submissions
          </h1>
          <Link href="/review" className="text-sm font-semibold text-forest underline">
            Reviewer dashboard
          </Link>
        </div>

        <section className="mt-8">
          <h2 className="font-display text-xl font-bold text-ink">
            Pending review ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="mt-2 text-ink/60">Nothing waiting right now.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {pending.map((r) => (
                <StoryRow key={r.id} row={r} />
              ))}
            </ul>
          )}
        </section>

        {actioned.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl font-bold text-ink">Recently actioned</h2>
            <ul className="mt-3 space-y-2">
              {actioned.slice(0, 20).map((r) => (
                <StoryRow key={r.id} row={r} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function StoryRow({ row }: { row: Row }) {
  const statusStyle =
    row.status === "published"
      ? "bg-mint text-forest"
      : row.status === "rejected"
        ? "bg-ink/10 text-ink/60"
        : "bg-butter text-ink";
  return (
    <li>
      <Link
        href={`/review/stories/${row.id}`}
        className="flex items-center justify-between rounded-md border border-ink/10 bg-white px-4 py-3 transition hover:border-forest/40"
      >
        <div>
          <p className="font-semibold text-ink">{row.display_name}</p>
          <p className="text-sm text-ink/55">
            {row.full_name} ·{" "}
            {row.edit_permission === "free_edit" ? "free edit" : "review first"} ·{" "}
            {new Date(row.created_at).toLocaleDateString()}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle}`}>
          {row.status.replace("_", " ")}
        </span>
      </Link>
    </li>
  );
}
