import type { Metadata } from "next";
import { requireCapability } from "@/lib/reviewer/session";
import { can } from "@/lib/reviewer/permissions";
import { getGeneControlRows, getAssignableReviewers } from "@/lib/genes/controlCenter";
import { getQueueSummary } from "@/lib/genes/generationQueue";
import GeneControlCenter from "@/components/review/genes/GeneControlCenter";

export const metadata: Metadata = { title: "Genes | RP Hope Team Portal", robots: { index: false } };
export const dynamic = "force-dynamic";

// The gene operations console. Reachable by anyone cleared to see the whole
// queue; the individual controls inside are gated further (generation and
// assignment each need their own capability), so a future role could be given
// read-only visibility here without also getting the ability to spend money on
// Opus or reassign other people's work.
export default async function GenesPage() {
  const session = await requireCapability("genes.review.all");

  const [rows, reviewers, queue] = await Promise.all([
    getGeneControlRows(),
    getAssignableReviewers(),
    getQueueSummary(),
  ]);

  return (
    <GeneControlCenter
      initialRows={rows}
      reviewers={reviewers}
      initialQueue={queue}
      canGenerate={can(session.profile, "genes.generate")}
      canAssign={can(session.profile, "genes.assign")}
    />
  );
}
