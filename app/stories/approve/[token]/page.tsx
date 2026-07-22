import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import ApprovalView from "./ApprovalView";

export const metadata: Metadata = { title: "Review your story — RP Hope", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function StoryApprovalPage({
  params,
}: {
  params: { token: string };
}) {
  const service = getServiceSupabase();
  if (!service) notFound();

  const { data: story } = await service
    .from("story_submissions")
    .select("id, full_name, story_text, status, submitter_responded_at")
    .eq("approval_token", params.token)
    .maybeSingle();
  if (!story) notFound();

  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-2xl px-5 py-16">
        <ApprovalView
          token={params.token}
          fullName={story.full_name}
          storyText={story.story_text}
          alreadyResponded={Boolean(story.submitter_responded_at) || story.status !== "pending_review"}
        />
      </div>
    </div>
  );
}
