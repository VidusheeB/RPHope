// In-app notification writing/reading for the reviewer portal.
//
// Inserts use the service-role client because a notification is written FOR
// SOMEONE ELSE (a reviewer submits → every admin is notified), which RLS
// deliberately forbids from a reviewer's own JWT. Reads use the RLS-scoped
// client so a user can only ever see their own.
//
// Every write is best-effort: a failed notification insert must never fail
// the underlying action (a publish that succeeded but couldn't notify is
// still a successful publish).

import { getServerSupabase } from "../supabaseServer";
import { getServiceSupabase } from "../supabaseAdmin";

export type NotificationType =
  | "review_submitted"
  | "changes_requested"
  | "gene_published"
  | "draft_assigned"
  | "ticket_created"
  | "ticket_reply"
  | "ticket_resolved";

export type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

/** Insert one notification. Never throws — see the module note. */
export async function notify(input: {
  recipient: string;
  actor?: string;
  type: NotificationType;
  title: string;
  body?: string;
  draftId?: string;
  ticketId?: string;
  href?: string;
}): Promise<void> {
  const service = getServiceSupabase();
  if (!service) return;
  try {
    await service.from("notifications").insert({
      recipient: input.recipient,
      actor: input.actor ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      draft_id: input.draftId ?? null,
      ticket_id: input.ticketId ?? null,
      href: input.href ?? null,
    });
  } catch {
    // Intentionally swallowed — see module note.
  }
}

/** Notify every active admin (the common case: something needs triage). */
export async function notifyAdmins(input: {
  actor?: string;
  type: NotificationType;
  title: string;
  body?: string;
  draftId?: string;
  ticketId?: string;
  href?: string;
}): Promise<void> {
  const service = getServiceSupabase();
  if (!service) return;
  const { data: admins } = await service
    .from("reviewer_profiles")
    .select("user_id")
    .eq("role", "admin")
    .eq("active", true);
  for (const a of admins ?? []) {
    if (a.user_id === input.actor) continue; // don't notify yourself
    await notify({ ...input, recipient: a.user_id });
  }
}

/** Notify whoever is actively assigned to a draft (may be nobody). */
export async function notifyDraftAssignee(
  draftId: string,
  input: {
    actor?: string;
    type: NotificationType;
    title: string;
    body?: string;
    href?: string;
  }
): Promise<void> {
  const service = getServiceSupabase();
  if (!service) return;
  const { data: assignments } = await service
    .from("draft_assignments")
    .select("reviewer_id, status")
    .eq("draft_id", draftId);
  for (const a of assignments ?? []) {
    if (a.status === "completed" || a.reviewer_id === input.actor) continue;
    await notify({ ...input, recipient: a.reviewer_id, draftId });
  }
}

/** The current user's notifications, newest first (RLS-scoped). */
export async function getMyNotifications(limit = 20): Promise<NotificationRow[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, href, read, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((n) => ({
    id: n.id,
    type: n.type as NotificationType,
    title: n.title,
    body: n.body,
    href: n.href,
    read: n.read,
    createdAt: n.created_at,
  }));
}

export async function getMyUnreadCount(): Promise<number> {
  const supabase = getServerSupabase();
  if (!supabase) return 0;
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("read", false);
  return count ?? 0;
}
