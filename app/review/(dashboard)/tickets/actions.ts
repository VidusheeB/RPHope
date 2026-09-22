"use server";

// Conversation actions.
//
// Writes go through the RLS-scoped client so the database enforces who may
// post where, with a capability check in front for a clear refusal message
// rather than a raw policy error.

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabaseServer";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { getReviewerSession } from "@/lib/reviewer/session";
import { can } from "@/lib/reviewer/permissions";
import { reviewHref } from "@/lib/reviewer/paths";
import { logAudit } from "@/lib/reviewer/audit";
import { notify, notifyAdmins } from "@/lib/reviewer/notifications";
import type { TicketStatus, TicketType } from "@/lib/reviewer/tickets";
import type { ActionResult } from "@/app/review/actions";

/**
 * Start a conversation — general, or attached to a gene.
 *
 * draftId is optional: a null one is a general question. 0027 made the column
 * nullable and widened the insert policy to match, so both shapes are legal
 * at the database level too, not just here.
 */
export async function startConversationAction(input: {
  subject: string;
  body: string;
  draftId?: string | null;
  type?: TicketType;
}): Promise<ActionResult<{ id: string }>> {
  const session = await getReviewerSession();
  if (!session || !can(session.profile, "tickets.create")) {
    return { ok: false, error: "You don't have permission to start a conversation." };
  }
  if (!input.subject.trim()) return { ok: false, error: "Give your conversation a subject." };
  if (!input.body.trim()) return { ok: false, error: "Write a message." };

  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, error: "Server not configured." };

  const { data, error } = await supabase
    .from("review_tickets")
    .insert({
      draft_id: input.draftId ?? null,
      type: input.type ?? "other",
      subject: input.subject.trim(),
      description: input.body.trim(),
      severity: "normal",
      blocking: false,
      // Identity comes from the session, never the client.
      created_by: session.userId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await notifyAdmins({
    actor: session.userId,
    type: "ticket_created",
    title: `New conversation: ${input.subject.trim()}`,
    href: reviewHref(`/tickets/${data.id}`),
    ticketId: data.id,
  });
  await logAudit({
    actor: session.userId,
    action: "ticket_created",
    ticketId: data.id,
    draftId: input.draftId ?? undefined,
    after: { subject: input.subject.trim(), general: !input.draftId },
  });

  revalidatePath(reviewHref("/tickets"));
  return { ok: true, data: { id: data.id } };
}

/** Post a message. Internal notes are admin-only here AND in RLS. */
export async function replyAction(input: {
  conversationId: string;
  body: string;
  internalNote?: boolean;
}): Promise<ActionResult> {
  const session = await getReviewerSession();
  if (!session || !can(session.profile, "tickets.view.own")) {
    return { ok: false, error: "You don't have permission to reply." };
  }
  if (input.internalNote && !can(session.profile, "tickets.manage")) {
    return { ok: false, error: "You don't have permission to add an internal note." };
  }
  if (!input.body.trim()) return { ok: false, error: "Write a message first." };

  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, error: "Server not configured." };

  const { error } = await supabase.from("ticket_replies").insert({
    ticket_id: input.conversationId,
    author: session.userId,
    body: input.body.trim(),
    internal_note: input.internalNote ?? false,
  });
  if (error) return { ok: false, error: error.message };

  // Notify the other side. An internal note is admin-to-admin by definition,
  // so it must never reach the person who opened the conversation.
  if (!input.internalNote) {
    const service = getServiceSupabase();
    if (service) {
      const { data: t } = await service
        .from("review_tickets")
        .select("created_by, subject, assigned_admin")
        .eq("id", input.conversationId)
        .maybeSingle();
      if (t) {
        if (t.created_by !== session.userId) {
          await notify({
            recipient: t.created_by,
            actor: session.userId,
            type: "ticket_reply",
            title: `New reply: ${t.subject}`,
            href: reviewHref(`/tickets/${input.conversationId}`),
            ticketId: input.conversationId,
          });
        } else {
          await notifyAdmins({
            actor: session.userId,
            type: "ticket_reply",
            title: `New reply: ${t.subject}`,
            href: reviewHref(`/tickets/${input.conversationId}`),
            ticketId: input.conversationId,
          });
        }
      }
    }
  }

  await logAudit({
    actor: session.userId,
    action: "ticket_reply_added",
    ticketId: input.conversationId,
    after: { internalNote: input.internalNote ?? false },
  });

  revalidatePath(reviewHref(`/tickets/${input.conversationId}`));
  revalidatePath(reviewHref("/tickets"));
  return { ok: true };
}

/**
 * Change status and/or ownership. Admin-only.
 *
 * Ownership is a SIGNAL, not a lock: an assigned conversation stays visible to
 * every admin (rt_select is unchanged), so "Vidushee is handling this"
 * prevents duplicate replies without hiding organisational work. Nothing here
 * claims a conversation implicitly — opening one does not assign it.
 */
export async function updateConversationAction(input: {
  conversationId: string;
  status?: TicketStatus;
  assignedAdmin?: string | null;
}): Promise<ActionResult> {
  const session = await getReviewerSession();
  if (!session || !can(session.profile, "tickets.manage")) {
    return { ok: false, error: "You don't have permission to update a conversation." };
  }

  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };

  const patch: Record<string, unknown> = {};
  if (input.status) patch.status = input.status;
  if (input.assignedAdmin !== undefined) patch.assigned_admin = input.assignedAdmin;
  if (!Object.keys(patch).length) return { ok: true };

  const { error } = await service.from("review_tickets").update(patch).eq("id", input.conversationId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actor: session.userId,
    action: input.status === "resolved" ? "ticket_resolved" : "ticket_updated",
    ticketId: input.conversationId,
    after: patch,
  });

  revalidatePath(reviewHref(`/tickets/${input.conversationId}`));
  revalidatePath(reviewHref("/tickets"));
  return { ok: true };
}
