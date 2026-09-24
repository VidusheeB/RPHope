"use server";

// Direct message actions.
//
// Writes go through the RLS-scoped client so the database decides who may post
// where. The capability check in front only produces a friendlier refusal than
// a raw policy error — it is not the boundary.

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabaseServer";
import { getReviewerSession } from "@/lib/reviewer/session";
import { can } from "@/lib/reviewer/permissions";
import { reviewHref } from "@/lib/reviewer/paths";
import type { ActionResult } from "@/app/review/actions";

/**
 * Start a thread with one or more people.
 *
 * Creates the conversation, adds the sender plus every recipient, then posts
 * the first message. Participants are inserted BEFORE the message because the
 * message insert policy requires the author to already be a participant.
 */
export async function startThreadAction(input: {
  recipientIds: string[];
  body: string;
  title?: string;
}): Promise<ActionResult<{ id: string }>> {
  const session = await getReviewerSession();
  if (!session || !can(session.profile, "messages.send")) {
    return { ok: false, error: "You don't have permission to send messages." };
  }
  const recipients = Array.from(new Set(input.recipientIds.filter((id) => id !== session.userId)));
  if (!recipients.length) return { ok: false, error: "Choose at least one person to message." };
  if (!input.body.trim()) return { ok: false, error: "Write a message first." };

  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, error: "Server not configured." };

  const { data: convo, error: convoError } = await supabase
    .from("conversations")
    .insert({
      // A title is only meaningful for a group; a 1:1 is named by who is in it.
      title: recipients.length > 1 ? (input.title?.trim() || null) : null,
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (convoError || !convo) {
    return { ok: false, error: convoError?.message ?? "Could not start that conversation." };
  }

  const { error: partError } = await supabase.from("conversation_participants").insert(
    [session.userId, ...recipients].map((user_id) => ({
      conversation_id: convo.id,
      user_id,
    }))
  );
  if (partError) return { ok: false, error: partError.message };

  const { error: msgError } = await supabase.from("conversation_messages").insert({
    conversation_id: convo.id,
    author: session.userId,
    body: input.body.trim(),
  });
  if (msgError) return { ok: false, error: msgError.message };

  revalidatePath(reviewHref("/messages"));
  return { ok: true, data: { id: convo.id } };
}

/** Post to an existing thread. RLS refuses if the sender isn't a participant. */
export async function sendMessageAction(input: {
  threadId: string;
  body: string;
}): Promise<ActionResult> {
  const session = await getReviewerSession();
  if (!session || !can(session.profile, "messages.send")) {
    return { ok: false, error: "You don't have permission to send messages." };
  }
  if (!input.body.trim()) return { ok: false, error: "Write a message first." };

  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, error: "Server not configured." };

  const { error } = await supabase.from("conversation_messages").insert({
    conversation_id: input.threadId,
    author: session.userId,
    body: input.body.trim(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(reviewHref(`/messages/${input.threadId}`));
  revalidatePath(reviewHref("/messages"));
  return { ok: true };
}

/** Mark a thread read for the current person only (RLS scopes to own row). */
export async function markThreadReadAction(threadId: string): Promise<ActionResult> {
  const session = await getReviewerSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, error: "Server not configured." };

  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", threadId)
    .eq("user_id", session.userId);

  return { ok: true };
}
