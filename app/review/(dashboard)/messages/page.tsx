import type { Metadata } from "next";
import { requireCapability } from "@/lib/reviewer/session";
import { getThreads, getMessageableMembers } from "@/lib/reviewer/messages";
import MessagesIndex from "@/components/review/messages/MessagesIndex";

export const metadata: Metadata = { title: "Messages | RP Hope Team Portal", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const session = await requireCapability("messages.send");
  const [threads, members] = await Promise.all([
    getThreads(session.userId),
    getMessageableMembers(session.userId),
  ]);
  return <MessagesIndex threads={threads} members={members} />;
}
