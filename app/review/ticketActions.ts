"use server";

// Server actions for the review ticket system ("Report an issue"). Same
// two-client pattern as app/review/actions.ts: reviewer-facing create/reply
// go through the RLS-scoped client (the database enforces a reviewer can
// only file/read tickets on drafts they're assigned to); admin triage
// actions re-check admin status and use the service-role client.

import { revalidatePath } from "next/cache";
import { getServerSupabase } from "@/lib/supabaseServer";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { getReviewerSession } from "@/lib/reviewer/session";
import type { TicketSeverity, TicketStatus, TicketType } from "@/lib/reviewer/tickets";
import type { ActionResult } from "./actions";

/**
 * File a new ticket. Auto-attaches identity/timestamp/URL server-side (never
 * trusts client-supplied `created_by`) so those fields can't be spoofed.
 * Does not touch draft content — the caller (ReportIssueButton) never
 * navigates away, so in-progress ReviewEditor edits are untouched.
 */
export async function createTicketAction(input: {
  draftId: string;
  type: TicketType;
  subject: string;
  description: string;
  sectionKey?: string;
  severity?: TicketSeverity;
  blocking: boolean;
  pageUrl?: string;
}): Promise<ActionResult<{ ticketId: string }>> {
  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, error: "Not configured." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!input.subject.trim() || !input.description.trim()) {
    return { ok: false, error: "Subject and description are required." };
  }

  const { data, error } = await supabase
    .from("review_tickets")
    .insert({
      draft_id: input.draftId,
      type: input.type,
      subject: input.subject.trim(),
      description: input.description.trim(),
      section_key: input.sectionKey ?? null,
      severity: input.severity ?? "normal",
      blocking: input.blocking,
      created_by: user.id,
      page_url: input.pageUrl ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/review/admin");
  return { ok: true, data: { ticketId: data.id } };
}

/** Reply to a ticket. Reviewers can reply on their own tickets (never as an
 *  internal note); admins can reply to any ticket, optionally as an
 *  internal-only note never shown to the reviewer. RLS enforces both rules
 *  independently of this check. */
export async function replyTicketAction(input: {
  ticketId: string;
  body: string;
  internalNote?: boolean;
}): Promise<ActionResult> {
  const supabase = getServerSupabase();
  if (!supabase) return { ok: false, error: "Not configured." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!input.body.trim()) return { ok: false, error: "Reply cannot be empty." };

  const { error } = await supabase.from("ticket_replies").insert({
    ticket_id: input.ticketId,
    author: user.id,
    body: input.body.trim(),
    internal_note: input.internalNote ?? false,
  });
  if (error) return { ok: false, error: error.message };

  // A reviewer replying moves an admin-owned ticket back into their queue's
  // attention; an admin replying (non-internal) signals the ball is back in
  // the reviewer's court. Best-effort status nudge, not a hard rule.
  revalidatePath("/review/admin");
  return { ok: true };
}

/** Admin-only: update a ticket's status/severity/blocking flag/assignee.
 *  Re-checked server-side from the DB-backed session, never trusted from
 *  the client, matching every other admin action in this app. */
export async function updateTicketAction(input: {
  ticketId: string;
  status?: TicketStatus;
  severity?: TicketSeverity;
  blocking?: boolean;
  assignedAdmin?: string | null;
}): Promise<ActionResult> {
  const session = await getReviewerSession();
  if (!session || session.profile.role !== "admin") return { ok: false, error: "Admin only." };

  const service = getServiceSupabase();
  if (!service) return { ok: false, error: "Server not configured." };

  const patch: Record<string, unknown> = {};
  if (input.status) patch.status = input.status;
  if (input.severity) patch.severity = input.severity;
  if (typeof input.blocking === "boolean") patch.blocking = input.blocking;
  if (input.assignedAdmin !== undefined) patch.assigned_admin = input.assignedAdmin;

  const { error } = await service.from("review_tickets").update(patch).eq("id", input.ticketId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/review/admin");
  return { ok: true };
}
