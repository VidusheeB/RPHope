import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/reviewer/session";
import { can } from "@/lib/reviewer/permissions";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import StoryReviewEditor from "./StoryReviewEditor";

export const metadata: Metadata = { title: "Review story | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewStoryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // This row is read with the SERVICE-ROLE client below (select "*"), which
  // bypasses RLS entirely — so this capability check is the only thing standing
  // between an account and the submitter's name, email, phone and consent record.
  const session = await requireCapability("stories.review");
  const service = getServiceSupabase();
  if (!service) notFound();

  const { data: story } = await service
    .from("story_submissions")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();
  if (!story) notFound();

  let videoUrl: string | null = null;
  if (story.video_path) {
    const { data } = await service.storage
      .from("story-videos")
      .createSignedUrl(story.video_path, 60 * 30); // 30 min, reviewer session length
    videoUrl = data?.signedUrl ?? null;
  }

  let audioUrl: string | null = null;
  if (story.audio_path) {
    const { data } = await service.storage
      .from("story-videos")
      .createSignedUrl(story.audio_path, 60 * 30);
    audioUrl = data?.signedUrl ?? null;
  }

  return (
    <StoryReviewEditor
      story={story}
      videoUrl={videoUrl}
      audioUrl={audioUrl}
      canPublish={can(session.profile, "stories.publish")}
    />
  );
}
