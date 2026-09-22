// Conversations — the reviewer/admin messaging surface.
//
// The database calls these `review_tickets`; the product calls them
// conversations, because that is what they are: a reviewer asks the RP Hope
// team something and the team answers. The UI language follows the product,
// the schema keeps its name.
//
// READS GO THROUGH THE RLS-SCOPED CLIENT ON PURPOSE. rt_select already says
// "your own, or everything if you're an admin", and trep_select already hides
// internal notes from non-admins. Using the cookie-bound client means those
// policies do the filtering, so a bug in this file cannot leak one reviewer's
// conversation to another — the database refuses before we get the chance.
// This is the opposite choice from the gene queue, which needs service-role
// precisely because it aggregates across everyone.

import { getServerSupabase } from "@/lib/supabaseServer";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import type { TicketSeverity, TicketStatus, TicketType } from "./tickets";

export type ConversationSummary = {
  id: string;
  ticketNumber: number;
  subject: string;
  status: TicketStatus;
  severity: TicketSeverity;
  type: TicketType;
  blocking: boolean;
  /** null for a general conversation. */
  draftId: string | null;
  geneSymbol: string | null;
  createdBy: string;
  createdByName: string | null;
  assignedAdmin: string | null;
  assignedAdminName: string | null;
  createdAt: string;
  updatedAt: string;
  /** Preview of the most recent visible message. */
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageFromAdmin: boolean;
};

export type ConversationMessage = {
  id: string;
  author: string;
  authorName: string | null;
  body: string;
  internalNote: boolean;
  createdAt: string;
  /** True when this message is from the person viewing the thread — drives
   *  the left/right bubble alignment. */
  isMine: boolean;
};

export type ConversationDetail = ConversationSummary & {
  description: string;
  sectionKey: string | null;
  pageUrl: string | null;
  messages: ConversationMessage[];
};

/** Display names for a set of user ids. Uses the service client because
 *  reviewer_profiles is admin-readable only under RLS — a reviewer must still
 *  see "Vidushee replied", and a display name is not sensitive. Only names are
 *  selected; no email, role or permission data crosses this boundary. */
async function displayNames(userIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length) return new Map();
  const service = getServiceSupabase();
  if (!service) return new Map();
  const { data } = await service
    .from("reviewer_profiles")
    .select("user_id, display_name")
    .in("user_id", ids);
  return new Map((data ?? []).map((r) => [r.user_id, r.display_name]));
}

/**
 * Conversations visible to the caller, newest activity first.
 *
 * No explicit "mine" filter: RLS already scopes a reviewer to their own and
 * gives an admin everything. Adding a redundant WHERE here would be the kind
 * of second, divergent copy of an access rule that eventually disagrees with
 * the first.
 */
export async function getConversations(): Promise<ConversationSummary[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];

  const { data: tickets } = await supabase
    .from("review_tickets")
    .select("*")
    .order("updated_at", { ascending: false });
  if (!tickets?.length) return [];

  const ids = tickets.map((t) => t.id);
  const draftIds = tickets.map((t) => t.draft_id).filter(Boolean) as string[];

  // Last visible reply per conversation. RLS hides internal notes from
  // non-admins here too, so a reviewer's preview can never quote one.
  const { data: replies } = await supabase
    .from("ticket_replies")
    .select("ticket_id, body, author, internal_note, created_at")
    .in("ticket_id", ids)
    .order("created_at", { ascending: false });

  const service = getServiceSupabase();
  const { data: drafts } = draftIds.length && service
    ? await service.from("gene_page_drafts").select("id, gene_symbol").in("id", draftIds)
    : { data: [] as { id: string; gene_symbol: string }[] };
  const geneById = new Map((drafts ?? []).map((d) => [d.id, d.gene_symbol]));

  const names = await displayNames([
    ...tickets.map((t) => t.created_by),
    ...tickets.map((t) => t.assigned_admin).filter(Boolean),
    ...(replies ?? []).map((r) => r.author),
  ]);

  const adminIds = new Set(tickets.map((t) => t.assigned_admin).filter(Boolean) as string[]);
  const lastByTicket = new Map<string, { body: string; created_at: string; author: string }>();
  for (const r of replies ?? []) {
    if (!lastByTicket.has(r.ticket_id)) lastByTicket.set(r.ticket_id, r);
  }

  return tickets.map((t) => {
    const last = lastByTicket.get(t.id);
    return {
      id: t.id,
      ticketNumber: t.ticket_number,
      subject: t.subject,
      status: t.status as TicketStatus,
      severity: t.severity as TicketSeverity,
      type: t.type as TicketType,
      blocking: t.blocking,
      draftId: t.draft_id,
      geneSymbol: t.draft_id ? (geneById.get(t.draft_id) ?? null) : null,
      createdBy: t.created_by,
      createdByName: names.get(t.created_by) ?? null,
      assignedAdmin: t.assigned_admin,
      assignedAdminName: t.assigned_admin ? (names.get(t.assigned_admin) ?? null) : null,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      lastMessage: last?.body ?? t.description,
      lastMessageAt: last?.created_at ?? t.created_at,
      lastMessageFromAdmin: last ? adminIds.has(last.author) : false,
    };
  });
}

/** One conversation and its full visible thread, or null if the caller may
 *  not see it (RLS returns nothing, which is the same as not existing). */
export async function getConversation(
  id: string,
  viewerId: string
): Promise<ConversationDetail | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data: t } = await supabase.from("review_tickets").select("*").eq("id", id).maybeSingle();
  if (!t) return null;

  const { data: replies } = await supabase
    .from("ticket_replies")
    .select("*")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  const service = getServiceSupabase();
  let geneSymbol: string | null = null;
  if (t.draft_id && service) {
    const { data: d } = await service
      .from("gene_page_drafts")
      .select("gene_symbol")
      .eq("id", t.draft_id)
      .maybeSingle();
    geneSymbol = d?.gene_symbol ?? null;
  }

  const names = await displayNames([
    t.created_by,
    t.assigned_admin,
    ...(replies ?? []).map((r) => r.author),
  ]);

  // The opening description is the first message in the thread — treating it
  // as a separate "ticket body" is what makes issue trackers read like forms
  // instead of conversations.
  const messages: ConversationMessage[] = [
    {
      id: `${t.id}-opening`,
      author: t.created_by,
      authorName: names.get(t.created_by) ?? null,
      body: t.description,
      internalNote: false,
      createdAt: t.created_at,
      isMine: t.created_by === viewerId,
    },
    ...(replies ?? []).map((r) => ({
      id: r.id,
      author: r.author,
      authorName: names.get(r.author) ?? null,
      body: r.body,
      internalNote: r.internal_note,
      createdAt: r.created_at,
      isMine: r.author === viewerId,
    })),
  ];

  return {
    id: t.id,
    ticketNumber: t.ticket_number,
    subject: t.subject,
    description: t.description,
    status: t.status as TicketStatus,
    severity: t.severity as TicketSeverity,
    type: t.type as TicketType,
    blocking: t.blocking,
    draftId: t.draft_id,
    geneSymbol,
    sectionKey: t.section_key,
    pageUrl: t.page_url,
    createdBy: t.created_by,
    createdByName: names.get(t.created_by) ?? null,
    assignedAdmin: t.assigned_admin,
    assignedAdminName: t.assigned_admin ? (names.get(t.assigned_admin) ?? null) : null,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    lastMessage: messages[messages.length - 1]?.body ?? null,
    lastMessageAt: messages[messages.length - 1]?.createdAt ?? t.created_at,
    lastMessageFromAdmin: false,
    messages,
  };
}

/** Admins available to take a conversation. */
export async function getAssignableAdmins(): Promise<{ userId: string; displayName: string }[]> {
  const service = getServiceSupabase();
  if (!service) return [];
  const { data } = await service
    .from("reviewer_profiles")
    .select("user_id, display_name")
    .eq("role", "admin")
    .eq("active", true);
  return (data ?? [])
    .map((r) => ({ userId: r.user_id, displayName: r.display_name }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
