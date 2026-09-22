import type { Metadata } from "next";
import { requireCapability } from "@/lib/reviewer/session";
import { can } from "@/lib/reviewer/permissions";
import { getConversations } from "@/lib/reviewer/conversations";
import ConversationList from "@/components/review/conversations/ConversationList";

export const metadata: Metadata = { title: "Conversations | RP Hope Team Portal", robots: { index: false } };
export const dynamic = "force-dynamic";

// One route for both audiences. A reviewer holds tickets.view.own and RLS
// scopes the query to their own conversations; an admin holds tickets.manage
// and the same query returns the whole shared inbox. There is no separate
// admin URL, and no place where this page decides visibility itself.
export default async function ConversationsPage() {
  const session = await requireCapability("tickets.view.own");
  const conversations = await getConversations();

  return (
    <ConversationList
      conversations={conversations}
      canManage={can(session.profile, "tickets.manage")}
      viewerId={session.userId}
    />
  );
}
