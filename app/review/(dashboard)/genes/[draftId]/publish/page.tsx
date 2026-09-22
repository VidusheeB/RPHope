import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/reviewer/session";
import { can } from "@/lib/reviewer/permissions";
import { getPublicationDetail } from "@/lib/genes/publicationQueue";
import PublicationReview from "@/components/review/genes/PublicationReview";

export const metadata: Metadata = { title: "Review & publish | RP Hope Team Portal", robots: { index: false } };
export const dynamic = "force-dynamic";

// Seeing the publication queue needs full-queue clearance; ACTING on it needs
// genes.publish / genes.approve, resolved separately below so a read-only
// admin can inspect what is pending without being able to ship it.
export default async function PublishGenePage({ params }: { params: { draftId: string } }) {
  const session = await requireCapability("genes.review.all");
  const detail = await getPublicationDetail(params.draftId);
  if (!detail) notFound();

  return (
    <PublicationReview
      detail={detail}
      canPublish={can(session.profile, "genes.publish")}
      canApprove={can(session.profile, "genes.approve")}
    />
  );
}
