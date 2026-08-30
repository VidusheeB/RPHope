"use server";

// Story review server actions — deliberately separate from app/review/actions.ts
// (the gene-draft assignment/flag/publish-RPC pipeline). Stories don't need
// assignments, flag resolutions, or versioned publish history, so this is a
// much lighter pipeline that reuses only the reviewer-auth helpers.

import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { requireReviewer } from "@/lib/reviewer/session";
import {
  sendApprovalRequestEmail,
  sendStoryPublishedEmail,
  sendStoryDeclinedEmail,
  buildApprovalUrl,
  emailConfigured,
} from "@/lib/email";

export type ActionResult = { ok: true } | { ok: false; error: string };

export type SendForApprovalResult =
  | { ok: true; emailSent: boolean; approvalUrl: string }
  | { ok: false; error: string };

/** Save reviewer edits to the story text. Any active reviewer. */
export async function saveStoryEdits(id: string, storyText: string): Promise<ActionResult> {
  await requireReviewer(); // redirects if not signed in / not active
  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Not configured." };

  const { error } = await service
    .from("story_submissions")
    .update({ story_text: storyText })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/review/stories/${id}`);
  return { ok: true };
}

/** Send the edited draft to the submitter for their approval. Only valid
 *  when edit_permission = 'review_first'. */
export async function sendForApproval(id: string): Promise<SendForApprovalResult> {
  const session = await requireReviewer();
  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Not configured." };

  const { data: story } = await service
    .from("story_submissions")
    .select("email, full_name, edit_permission")
    .eq("id", id)
    .maybeSingle();
  if (!story) return { ok: false, error: "Story not found." };
  if (story.edit_permission !== "review_first") {
    return { ok: false, error: "This submitter granted free-edit permission — publish directly instead." };
  }

  const token = crypto.randomBytes(24).toString("hex");
  const { error } = await service
    .from("story_submissions")
    .update({
      approval_token: token,
      final_story_sent_at: new Date().toISOString(),
      reviewed_by: session.email ?? session.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await sendApprovalRequestEmail(story.email as string, story.full_name as string, token);
  revalidatePath(`/review/stories/${id}`);
  return { ok: true, emailSent: emailConfigured, approvalUrl: buildApprovalUrl(token) };
}

/** Publish a story. Requires can_publish (from reviewer_profiles), same
 *  privilege check the gene-draft flow uses — publishing is the one
 *  irreversible-in-effect step, so it's gated more tightly than viewing/editing. */
export async function publishStory(id: string): Promise<ActionResult> {
  const session = await requireReviewer();
  if (!session.profile.can_publish) {
    return { ok: false, error: "You don't have publish permission." };
  }
  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Not configured." };

  const { data: story } = await service
    .from("story_submissions")
    .select("email, full_name")
    .eq("id", id)
    .maybeSingle();
  if (!story) return { ok: false, error: "Story not found." };

  const { error } = await service
    .from("story_submissions")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      reviewed_by: session.email ?? session.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await sendStoryPublishedEmail(story.email as string, story.full_name as string, id);
  revalidatePath("/stories");
  revalidatePath(`/stories/${id}`);
  revalidatePath(`/review/stories/${id}`);
  return { ok: true };
}

/** Take a published story down (e.g. the submitter asked, or something needs
 *  fixing). Sets status back to 'archived' rather than deleting the row, so
 *  it can be reviewed/republished later. Same publish-permission gate as
 *  publishing — taking a live page down is just as consequential as
 *  putting one up. */
export async function unpublishStoryAction(id: string): Promise<ActionResult> {
  const session = await requireReviewer();
  if (!session.profile.can_publish) {
    return { ok: false, error: "You don't have publish permission." };
  }
  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Not configured." };

  const { error } = await service
    .from("story_submissions")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("status", "published");
  if (error) return { ok: false, error: error.message };

  revalidatePath("/stories");
  // The story's own page was missing here, so a taken-down story could still
  // be served from cache at its direct URL.
  revalidatePath(`/stories/${id}`);
  revalidatePath(`/review/stories/${id}`);
  revalidatePath("/review/stories");
  return { ok: true };
}

/** Decline a submission. Any active reviewer. */
export async function rejectStory(id: string, note?: string): Promise<ActionResult> {
  const session = await requireReviewer();
  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Not configured." };

  const { data: story } = await service
    .from("story_submissions")
    .select("email, full_name")
    .eq("id", id)
    .maybeSingle();
  if (!story) return { ok: false, error: "Story not found." };

  const { error } = await service
    .from("story_submissions")
    .update({
      status: "rejected",
      reviewer_notes: note ?? null,
      reviewed_by: session.email ?? session.userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await sendStoryDeclinedEmail(story.email as string, story.full_name as string);
  revalidatePath(`/review/stories/${id}`);
  return { ok: true };
}
