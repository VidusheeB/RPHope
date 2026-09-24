// Admin Home — "what needs my attention right now?"
//
// Deliberately not an analytics page. Every number here is a QUEUE an admin
// can act on, and every one is clickable through to the work. A count that
// nobody can do anything about (total genes, total published) belongs on the
// Genes page, not here.
//
// Assembled from the same sources the individual pages use, so Home can never
// disagree with the page it links to.

import { getGeneControlRows, type GeneControlRow } from "@/lib/genes/controlCenter";
import { getAwaitingPublication, type AwaitingPublication } from "@/lib/genes/publicationQueue";
import { getConversations, type ConversationSummary } from "@/lib/reviewer/conversations";
import { getRecentAuditLog, type AuditLogRow } from "@/lib/reviewer/data";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { isOpenTicketStatus } from "@/lib/reviewer/tickets";

export type PendingStory = {
  id: string;
  displayName: string;
  createdAt: string;
};

export type AdminHomeData = {
  needsGeneration: GeneControlRow[];
  failedGeneration: GeneControlRow[];
  unassigned: GeneControlRow[];
  inReview: GeneControlRow[];
  awaitingPublication: AwaitingPublication[];
  /** Open tickets whose last word came from the person who raised them — the
   *  ones actually waiting on the team, as opposed to merely being open. */
  needsReply: ConversationSummary[];
  newStories: PendingStory[];
  recentActivity: AuditLogRow[];
};

async function getPendingStories(): Promise<PendingStory[]> {
  const service = getServiceSupabase();
  if (!service) return [];
  const { data } = await service
    .from("story_submissions")
    // Only what Home needs to render a row. Submitter PII is not selected
    // here even though the service client could read it — Home has no use for
    // it, and the narrowest query is the one that can't leak.
    .select("id, display_name, created_at")
    .eq("status", "pending_review")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    displayName: r.display_name || "Anonymous",
    createdAt: r.created_at,
  }));
}

export async function getAdminHomeData(): Promise<AdminHomeData> {
  const [genes, awaitingPublication, tickets, newStories, recentActivity] = await Promise.all([
    getGeneControlRows(),
    getAwaitingPublication(),
    getConversations(),
    getPendingStories(),
    getRecentAuditLog(12),
  ]);

  return {
    needsGeneration: genes.filter((g) => g.bucket === "needs_generation"),
    failedGeneration: genes.filter((g) => g.bucket === "failed"),
    unassigned: genes.filter((g) => g.bucket === "unassigned"),
    inReview: genes.filter((g) => g.bucket === "in_review"),
    awaitingPublication,
    needsReply: tickets.filter((t) => isOpenTicketStatus(t.status) && !t.lastMessageFromAdmin),
    newStories,
    recentActivity,
  };
}

/** Time-of-day greeting. Computed on the CLIENT, because the server runs in
 *  UTC on Vercel and would wish a Californian good evening over breakfast. */
export function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
