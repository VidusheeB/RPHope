import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/reviewer/session";
import { getThread } from "@/lib/reviewer/messages";
import MessageThread from "@/components/review/messages/MessageThread";

export const metadata: Metadata = { title: "Message | RP Hope Team Portal", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MessageThreadPage({ params }: { params: { id: string } }) {
  const session = await requireCapability("messages.send");

  // Reads through the RLS-scoped client: a non-participant gets nothing back
  // and lands on a 404, indistinguishable from a thread that doesn't exist.
  // That includes admins — there is no privileged read of private messages.
  const thread = await getThread(params.id, session.userId);
  if (!thread) notFound();

  return <MessageThread thread={thread} />;
}
