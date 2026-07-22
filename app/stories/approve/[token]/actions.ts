"use server";

// Public, UNAUTHENTICATED actions for the token-gated story-approval page.
// The approval_token IS the auth — anyone with the link (sent only to the
// submitter's own email) can act on it once. Uses the service-role client
// because the row isn't `published` yet, so the anon-key RLS policy
// wouldn't allow reading it here.

import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { sendStoryPublishedEmail } from "@/lib/email";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function findByToken(service: ReturnType<typeof getServiceSupabase>, token: string) {
  if (!service) return null;
  const { data } = await service
    .from("story_submissions")
    .select("id, full_name, email, status, approval_token")
    .eq("approval_token", token)
    .maybeSingle();
  return data;
}

export async function approveStory(token: string): Promise<ActionResult> {
  const service = getServiceSupabase();
  const story = await findByToken(service, token);
  if (!story) return { ok: false, error: "This link isn't valid." };
  if (story.status !== "pending_review") {
    return { ok: false, error: "This story has already been actioned." };
  }

  const { error } = await service!
    .from("story_submissions")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      submitter_responded_at: new Date().toISOString(),
      submitter_requested_changes: false,
    })
    .eq("id", story.id);
  if (error) return { ok: false, error: error.message };

  await sendStoryPublishedEmail(story.email as string, story.full_name as string, story.id as string);
  return { ok: true };
}

export async function requestChanges(token: string, note: string): Promise<ActionResult> {
  const service = getServiceSupabase();
  const story = await findByToken(service, token);
  if (!story) return { ok: false, error: "This link isn't valid." };
  if (story.status !== "pending_review") {
    return { ok: false, error: "This story has already been actioned." };
  }

  const { error } = await service!
    .from("story_submissions")
    .update({
      submitter_responded_at: new Date().toISOString(),
      submitter_requested_changes: true,
      reviewer_notes: note || null,
    })
    .eq("id", story.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
