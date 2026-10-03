import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/reviewer/session";
import { can } from "@/lib/reviewer/permissions";
import { getPublicationDetail } from "@/lib/genes/publicationQueue";
import { getResearchItems } from "@/lib/researchRepo";
import PublicationReview from "@/components/review/genes/PublicationReview";

export const metadata: Metadata = { title: "Publish | RP Hope Team Portal", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function PublishGenePage({ params }: { params: { draftId: string } }) {
  // Only someone who can actually publish belongs on this screen. It used to
  // admit anyone with full-queue visibility and then hide the button, which
  // is a page that exists to show you a door you cannot open.
  const session = await requireCapability("genes.publish");

  const detail = await getPublicationDetail(params.draftId);
  if (!detail) notFound();
  const articles = await getResearchItems(detail.geneSlug);

  // Whose review is this concluding? If nobody else submitted it, the admin is
  // finishing their OWN review — no approval, no "request changes" (you can't
  // send work back to yourself), just the final look and Publish. If a
  // reviewer submitted it, the admin is judging that reviewer's work.
  const isOwnReview = !detail.submittedById || detail.submittedById === session.userId;

  return (
    <PublicationReview
      detail={detail}
      articles={articles}
      isOwnReview={isOwnReview}
      canPublish={can(session.profile, "genes.publish")}
      canRequestChanges={can(session.profile, "genes.approve")}
    />
  );
}
