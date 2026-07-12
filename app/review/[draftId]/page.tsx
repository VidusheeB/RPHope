import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireReviewer } from "@/lib/reviewer/session";
import { getDraftForReview } from "@/lib/reviewer/data";
import ReviewEditor from "@/components/review/ReviewEditor";

export const metadata: Metadata = { title: "Review draft | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewDraftPage({ params }: { params: { draftId: string } }) {
  const session = await requireReviewer();
  // RLS: returns null unless this reviewer is assigned to the draft.
  const draft = await getDraftForReview(params.draftId);
  if (!draft) notFound();

  return (
    <main className="min-h-screen bg-cream px-5 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/review" className="text-sm font-semibold text-forest underline">
          ← Dashboard
        </Link>
        <h1 className="mt-3 font-display text-3xl font-medium text-forest">
          {draft.geneSymbol}
          <span className="ml-2 text-base text-ink/50">draft review</span>
        </h1>
        <p className="mt-1 text-sm text-ink/60">
          {draft.unresolvedFlags} of {draft.reviewFlags.length} flags unresolved
          {draft.sectionsComplete ? "" : " · some sections incomplete"}
        </p>

        <div className="mt-8">
          <ReviewEditor
            draftId={draft.draftId}
            geneSlug={draft.geneSlug}
            initialContent={draft.content}
            reviewFlags={draft.reviewFlags}
            initialResolutions={draft.resolutions}
            reviewerCanPublish={session.profile.can_publish}
          />
        </div>
      </div>
    </main>
  );
}
