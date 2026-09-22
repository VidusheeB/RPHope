import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/reviewer/session";
import { can } from "@/lib/reviewer/permissions";
import { getConversation, getAssignableAdmins } from "@/lib/reviewer/conversations";
import ConversationThread from "@/components/review/conversations/ConversationThread";

export const metadata: Metadata = { title: "Conversation | RP Hope Team Portal", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const session = await requireCapability("tickets.view.own");

  // getConversation reads through the RLS-scoped client, so a reviewer asking
  // for someone else's conversation gets nothing back and lands on a 404 —
  // indistinguishable from a conversation that doesn't exist, which is the
  // right answer: it shouldn't be possible to probe for other people's threads.
  const conversation = await getConversation(params.id, session.userId);
  if (!conversation) notFound();

  const canManage = can(session.profile, "tickets.manage");
  const admins = canManage ? await getAssignableAdmins() : [];

  return (
    <ConversationThread
      conversation={conversation}
      canManage={canManage}
      admins={admins}
      viewerId={session.userId}
    />
  );
}
