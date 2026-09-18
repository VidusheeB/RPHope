// Live generation state for the Genes control center's poll.
//
// Also self-heals the worker: if there is queued work but nothing is making
// progress, this kicks a fresh worker invocation. That means a run recovers on
// its own after a deploy, a crashed invocation, or a missed kick — an admin
// simply having the page open is enough to restart a stalled queue.

import { NextResponse } from "next/server";
import { getReviewerSession } from "@/lib/reviewer/session";
import { can } from "@/lib/reviewer/permissions";
import {
  getGeneGenerationState,
  getQueueSummary,
  hasPendingWork,
} from "@/lib/genes/generationQueue";
import { triggerGenerationWorker } from "@/lib/genes/worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getReviewerSession();
  if (!session || !can(session.profile, "genes.review.all")) {
    return NextResponse.json({ ok: false, error: "Not permitted." }, { status: 403 });
  }

  const [state, summary] = await Promise.all([getGeneGenerationState(), getQueueSummary()]);

  // Nudge the worker whenever work is outstanding. triggerGenerationWorker
  // returns immediately and a duplicate kick is harmless — the worker claims
  // jobs atomically, so a second invocation finding nothing simply exits.
  if (await hasPendingWork()) {
    void triggerGenerationWorker();
  }

  return NextResponse.json({
    ok: true,
    summary,
    genes: state.map((g) => ({
      geneSlug: g.geneSlug,
      geneSymbol: g.geneSymbol,
      hasDraft: g.hasDraft,
      eligible: g.eligible,
      status: g.latestJob?.status ?? null,
      error: g.latestJob?.error ?? null,
      finishedAt: g.latestJob?.finishedAt ?? null,
    })),
  });
}
