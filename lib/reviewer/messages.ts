// Direct messages between team members.
//
// EVERY read here goes through the RLS-SCOPED client, never service-role.
// That is not a stylistic preference: the privacy guarantee of this feature is
// "only participants can read a thread, admins included", and the only way to
// make that true is to let the database enforce it. A service-role read would
// make this file the sole thing standing between people's private messages and
// anyone who can reach it.
//
// The one exception is display names — reviewer_profiles is admin-only under
// RLS, and a reviewer still has to see who they're talking to. Only names
// cross that boundary; never emails, roles, or message content.

import { getServerSupabase } from "@/lib/supabaseServer";
import { getServiceSupabase } from "@/lib/supabaseAdmin";

export type {
  ThreadParticipant,
  ThreadSummary,
  ThreadMessage,
  ThreadDetail,
} from "./messageModel";
export { threadLabel } from "./messageModel";

import type { ThreadParticipant, ThreadSummary, ThreadDetail } from "./messageModel";

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

/** Threads the viewer is in. RLS scopes this — there is no "mine" filter and
 *  there must not be one, or the access rule would exist in two places. */
export async function getThreads(viewerId: string): Promise<ThreadSummary[]> {
  const supabase = getServerSupabase();
  if (!supabase) return [];

  const { data: convos } = await supabase
    .from("conversations")
    .select("id, title, created_by, updated_at")
    .order("updated_at", { ascending: false });
  if (!convos?.length) return [];

  const ids = convos.map((c) => c.id);

  const [{ data: participants }, { data: messages }, { data: mine }] = await Promise.all([
    supabase.from("conversation_participants").select("conversation_id, user_id").in("conversation_id", ids),
    supabase
      .from("conversation_messages")
      .select("conversation_id, body, author, created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", viewerId),
  ]);

  const names = await displayNames([
    ...(participants ?? []).map((p) => p.user_id),
    ...(messages ?? []).map((m) => m.author),
  ]);

  const byThread = new Map<string, string[]>();
  for (const p of participants ?? []) {
    byThread.set(p.conversation_id, [...(byThread.get(p.conversation_id) ?? []), p.user_id]);
  }
  const lastByThread = new Map<string, { body: string; author: string; created_at: string }>();
  for (const m of messages ?? []) {
    if (!lastByThread.has(m.conversation_id)) lastByThread.set(m.conversation_id, m);
  }
  const readAt = new Map((mine ?? []).map((r) => [r.conversation_id, r.last_read_at]));

  return convos.map((c) => {
    const memberIds = byThread.get(c.id) ?? [];
    const others = memberIds
      .filter((id) => id !== viewerId)
      .map((id) => ({ userId: id, displayName: names.get(id) ?? "Someone" }));
    const last = lastByThread.get(c.id);
    const seen = readAt.get(c.id);
    return {
      id: c.id,
      title: c.title,
      isGroup: memberIds.length > 2,
      others,
      lastMessage: last?.body ?? null,
      lastMessageAt: last?.created_at ?? null,
      lastMessageAuthor: last ? (names.get(last.author) ?? null) : null,
      // Your own message never counts as unread.
      unread: Boolean(
        last && last.author !== viewerId && (!seen || new Date(last.created_at) > new Date(seen))
      ),
      updatedAt: c.updated_at,
    };
  });
}

/** One thread. Returns null when the viewer is not a participant — RLS gives
 *  back nothing, which is indistinguishable from "does not exist". That is
 *  the right answer: it must not be possible to probe for other people's
 *  threads. */
export async function getThread(id: string, viewerId: string): Promise<ThreadDetail | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const { data: convo } = await supabase
    .from("conversations")
    .select("id, title, created_by, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!convo) return null;

  const [{ data: participants }, { data: messages }] = await Promise.all([
    supabase.from("conversation_participants").select("user_id").eq("conversation_id", id),
    supabase
      .from("conversation_messages")
      .select("id, author, body, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const names = await displayNames([
    ...(participants ?? []).map((p) => p.user_id),
    ...(messages ?? []).map((m) => m.author),
  ]);

  const all = (participants ?? []).map((p) => ({
    userId: p.user_id,
    displayName: names.get(p.user_id) ?? "Someone",
  }));
  const others = all.filter((p) => p.userId !== viewerId);

  return {
    id: convo.id,
    title: convo.title,
    isGroup: all.length > 2,
    others,
    participants: all,
    lastMessage: null,
    lastMessageAt: null,
    lastMessageAuthor: null,
    unread: false,
    updatedAt: convo.updated_at,
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      author: m.author,
      authorName: names.get(m.author) ?? null,
      body: m.body,
      createdAt: m.created_at,
      isMine: m.author === viewerId,
    })),
  };
}

/** Everyone the viewer can message: any active team member but themselves.
 *  Deliberately NOT role-filtered — any member may message any other, and a
 *  future role should be reachable without touching this. */
export async function getMessageableMembers(viewerId: string): Promise<ThreadParticipant[]> {
  const service = getServiceSupabase();
  if (!service) return [];
  const { data } = await service
    .from("reviewer_profiles")
    .select("user_id, display_name, active")
    .eq("active", true);
  return (data ?? [])
    .filter((r) => r.user_id !== viewerId)
    .map((r) => ({ userId: r.user_id, displayName: r.display_name || "(no name)" }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Unread thread count, for the nav badge. */
export async function getUnreadThreadCount(viewerId: string): Promise<number> {
  return (await getThreads(viewerId)).filter((t) => t.unread).length;
}
