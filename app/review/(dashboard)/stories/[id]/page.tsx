import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireReviewer } from "@/lib/reviewer/session";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import StoryReviewEditor from "./StoryReviewEditor";

export const metadata: Metadata = { title: "Review story | RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ReviewStoryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireReviewer();
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
      canPublish={session.profile.can_publish}
    />
  );
}
