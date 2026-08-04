import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/reviewer/session";
import { getGeneAdminDetail } from "@/lib/reviewer/geneDetail";
import { getAdminOverview, getAuditLogForDraft } from "@/lib/reviewer/data";
import { getResearchItems } from "@/lib/researchRepo";
import { reviewHref } from "@/lib/reviewer/paths";
import { REVIEW_STATE_LABELS, PUBLICATION_STATE_LABELS } from "@/lib/reviewer/dashboardStatus";
import GeneAdminWorkspace from "@/components/review/GeneAdminWorkspace";

export const metadata: Metadata = { title: "Gene review | RP Hope Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function GeneAdminDetailPage({ params }: { params: { draftId: string } }) {
  const session = await requireAdmin();
  const detail = await getGeneAdminDetail(params.draftId);
  if (!detail) notFound();

  const [{ reviewers }, activity, articles] = await Promise.all([
    getAdminOverview(),
    getAuditLogForDraft(params.draftId),
    getResearchItems(detail.geneSlug),
  ]);

  return (
    <div>
      <Link href={reviewHref("/admin/genes")} className="text-sm font-semibold text-forest underline">
        ← Gene Reviews
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-medium text-forest">
          {detail.geneSymbol}
          {detail.fullName && <span className="ml-2 text-base font-normal text-ink/50">{detail.fullName}</span>}
        </h1>
        <span className="rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink/70">
          {REVIEW_STATE_LABELS[detail.reviewState]}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            detail.publicationState === "published"
              ? "bg-forest text-white"
              : detail.publicationState === "unpublished"
                ? "bg-maroon/15 text-maroon"
                : "bg-ink/5 text-ink/50"
          }`}
        >
          {PUBLICATION_STATE_LABELS[detail.publicationState]}
        </span>
      </div>

      <GeneAdminWorkspace
        detail={detail}
        reviewers={reviewers.filter((r) => r.active)}
        activity={activity}
        articles={articles}
        adminCanPublish={session.profile.can_publish}
      />
    </div>
  );
}
