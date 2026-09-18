"use server";

// Admin gene-operations server actions: starting Opus generation and retrying
// failures.
//
// Every action re-derives authorization from the DB-backed session via a
// capability check. The UI hides controls the viewer can't use, but that is
// presentation — these checks are the boundary, and they hold against a
// hand-rolled request or a stale tab just as well as against a button press.

import { revalidatePath } from "next/cache";
import { getReviewerSession } from "@/lib/reviewer/session";
import { can } from "@/lib/reviewer/permissions";
import { reviewHref } from "@/lib/reviewer/paths";
import { logAudit } from "@/lib/reviewer/audit";
import {
  enqueueGeneGeneration,
  getEligibleGenes,
  type EnqueueResult,
} from "@/lib/genes/generationQueue";
import { triggerGenerationWorker } from "@/lib/genes/worker";

export type GenerationActionResult =
  | { ok: true; queuedCount: number; skipped: EnqueueResult["skipped"]; batchId: string }
  | { ok: false; error: string };

async function requireGenerate() {
  const session = await getReviewerSession();
  if (!session || !can(session.profile, "genes.generate")) return null;
  return session;
}

/**
 * Queue generation for an explicit list of genes ("Run Selected").
 *
 * The posted slugs are treated as a REQUEST, not as truth: eligibility is
 * recomputed server-side and the database's partial unique index is the final
 * race guard, so a stale tab offering an already-generated gene gets a
 * "skipped" entry rather than a duplicate Opus run (and duplicate spend).
 */
export async function runGenerationAction(geneSlugs: string[]): Promise<GenerationActionResult> {
  const session = await requireGenerate();
  if (!session) return { ok: false, error: "You don't have permission to run gene generation." };
  if (!geneSlugs.length) return { ok: false, error: "No genes selected." };

  const result = await enqueueGeneGeneration(geneSlugs, session.userId);

  if (result.queued.length) {
    await logAudit({
      actor: session.userId,
      action: "gene_generation_started",
      after: {
        batchId: result.batchId,
        count: result.queued.length,
        genes: result.queued.map((g) => g.geneSymbol),
      },
    });
    // Start the worker without waiting for it — generation continues
    // server-side regardless of what the admin's browser does next.
    await triggerGenerationWorker();
  }

  revalidatePath(reviewHref("/genes"));
  return {
    ok: true,
    queuedCount: result.queued.length,
    skipped: result.skipped,
    batchId: result.batchId,
  };
}

/**
 * "Run All" — every gene currently eligible.
 *
 * Eligibility is resolved here rather than by sending the client's visible
 * list, so already-generated, queued, running and otherwise ineligible genes
 * are excluded by construction, per the spec.
 */
export async function runAllGenerationAction(): Promise<GenerationActionResult> {
  const session = await requireGenerate();
  if (!session) return { ok: false, error: "You don't have permission to run gene generation." };

  const eligible = await getEligibleGenes();
  if (!eligible.length) return { ok: false, error: "No genes are eligible for generation right now." };

  return runGenerationAction(eligible.map((g) => g.geneSlug));
}

/** Retry one failed gene. Goes through the same enqueue path, so a gene that
 *  someone else already requeued in the meantime is skipped rather than
 *  double-queued. */
export async function retryGenerationAction(geneSlug: string): Promise<GenerationActionResult> {
  const session = await requireGenerate();
  if (!session) return { ok: false, error: "You don't have permission to run gene generation." };
  return runGenerationAction([geneSlug]);
}
