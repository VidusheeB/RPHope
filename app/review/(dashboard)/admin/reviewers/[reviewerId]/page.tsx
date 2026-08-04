import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/reviewer/session";
import { getReviewerDetail } from "@/lib/reviewer/reviewerDetail";
import { getAdminOverview } from "@/lib/reviewer/data";
import { reviewHref } from "@/lib/reviewer/paths";
import ReviewerDetailPanel from "@/components/review/ReviewerDetailPanel";

export const metadata: Metadata = { title: "Reviewer | RP Hope Admin", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewerDetailPage({ params }: { params: { reviewerId: string } }) {
  await requireAdmin();
  const detail = await getReviewerDetail(params.reviewerId);
  if (!detail) notFound();
  const { reviewers } = await getAdminOverview();

  return (
    <div>
      <Link href={reviewHref("/admin/reviewers")} className="text-sm font-semibold text-forest underline">
        ← Reviewers
      </Link>
      <ReviewerDetailPanel detail={detail} otherReviewers={reviewers.filter((r) => r.active && r.user_id !== detail.userId)} />
    </div>
  );
}
