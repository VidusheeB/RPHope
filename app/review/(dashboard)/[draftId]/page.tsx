import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getReviewerSession } from "@/lib/reviewer/session";
import { getDraftForReview, getSentenceReviews } from "@/lib/reviewer/data";
import ReviewEditor from "@/components/review/ReviewEditor";

export const metadata: Metadata = { title: "Review draft | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewDraftPage({ params }: { params: { draftId: string } }) {
  const session = await getReviewerSession();
  if (!session) notFound();
  // RLS on gene_page_drafts already allows admins to read any draft
  // (gpd_select_assigned: auth_is_assigned(id) OR auth_is_admin()) — no
  // admin-specific bypass needed here, the database already handles it.
  const draft = await getDraftForReview(params.draftId);
  if (!draft) notFound();
  const sentenceReviews = await getSentenceReviews(params.draftId);

  return (
    <div>
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
        {" · status: "}
        {draft.reviewStatus.replace(/_/g, " ")}
      </p>
      {draft.reviewStatus === "changes_requested" && draft.changesRequestedNote && (
        <p className="mt-3 rounded-lg border border-lilac bg-lilac/30 p-3 text-sm text-ink/80">
          <strong>Admin requested changes:</strong> {draft.changesRequestedNote}
        </p>
      )}

      <div className="mt-8">
        <ReviewEditor
          draftId={draft.draftId}
          geneSlug={draft.geneSlug}
          initialContent={draft.content}
          reviewFlags={draft.reviewFlags}
          initialResolutions={draft.resolutions}
          initialSentenceReviews={sentenceReviews}
          reviewerCanPublish={session.profile.can_publish}
          isAdmin={session.profile.role === "admin"}
          reviewStatus={draft.reviewStatus}
        />
      </div>
    </div>
  );
}
