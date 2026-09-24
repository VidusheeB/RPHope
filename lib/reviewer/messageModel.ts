// Pure types and labelling for direct messages. No network, no server-only
// imports — same split as tickets.ts and dashboardStatus.ts.
//
// This file exists because lib/reviewer/messages.ts imports the RLS-scoped
// Supabase client, which reaches next/headers and therefore cannot be pulled
// into a client component. The thread components need the types and the label
// rule, so those live here instead.

export type ThreadParticipant = {
  userId: string;
  displayName: string;
};

export type ThreadSummary = {
  id: string;
  title: string | null;
  isGroup: boolean;
  /** Everyone except the viewer — what a thread is "called" when untitled. */
  others: ThreadParticipant[];
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageAuthor: string | null;
  unread: boolean;
  updatedAt: string;
};

export type ThreadMessage = {
  id: string;
  author: string;
  authorName: string | null;
  body: string;
  createdAt: string;
  isMine: boolean;
};

export type ThreadDetail = ThreadSummary & {
  participants: ThreadParticipant[];
  messages: ThreadMessage[];
};

/** How a thread is labelled when it has no title — by who is in it, like a
 *  text thread. Larger groups summarise rather than running off the row. */
export function threadLabel(others: ThreadParticipant[], title: string | null): string {
  if (title?.trim()) return title.trim();
  if (others.length === 0) return "Just you";
  if (others.length <= 2) return others.map((o) => o.displayName).join(" and ");
  return `${others[0].displayName}, ${others[1].displayName} and ${others.length - 2} more`;
}
