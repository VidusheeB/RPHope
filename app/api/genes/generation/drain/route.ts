// The Opus generation worker.
//
// Claims queued genes one at a time and runs the REAL existing pipeline
// (lib/geneResearch → draftGenePage): NCBI verification, PubMed/EuropePMC/
// ELink retrieval, ClinicalTrials.gov, then one Opus call. Nothing here
// simulates or reimplements generation.
//
// Runs entirely server-side, so a batch keeps going after the admin navigates
// away or closes the tab. When its time budget runs out with work still
// queued, it hands off to a fresh invocation of itself rather than trying to
// outlive the platform's function limit.

import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { draftGenePage } from "@/lib/geneResearch/pipeline";
import {
  claimNextJob,
  completeJob,
  failJob,
  heartbeatJob,
  hasPendingWork,
} from "@/lib/genes/generationQueue";
import { workerSecret, triggerGenerationWorker } from "@/lib/genes/worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Generating one gene is a multi-minute operation; give the worker the most
// wall-clock the platform allows.
export const maxDuration = 300;

/** Stop claiming NEW work past this point so the job in flight has room to
 *  finish and be recorded before the platform kills the invocation. A job
 *  killed mid-flight is recovered by the stale-heartbeat requeue in
 *  claim_next_generation_job, but a clean handoff is much better. */
const CLAIM_BUDGET_MS = 3 * 60 * 1000;

/** Keep the heartbeat fresh while a long gene runs, so the stale-worker
 *  requeue doesn't reclaim a job that is actually progressing. */
const HEARTBEAT_MS = 30 * 1000;

/** Turn any thrown value into one short operator-facing sentence. The queue
 *  UI shows this next to a Retry button — model traces and stack dumps
 *  deliberately do not go in the database. */
function shortReason(err: unknown): string {
  if (err instanceof Error) return err.message.split("\n")[0].slice(0, 300);
  return String(err).slice(0, 300);
}

export async function POST(req: Request) {
  const secret = workerSecret();
  if (!secret || req.headers.get("x-worker-secret") !== secret) {
    // Opaque on purpose — this endpoint's existence shouldn't be probeable.
    return new NextResponse("Not found", { status: 404 });
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ ok: false, error: "Server not configured." }, { status: 503 });
  }

  const startedAt = Date.now();
  const processed: { gene: string; outcome: string }[] = [];

  while (Date.now() - startedAt < CLAIM_BUDGET_MS) {
    const job = await claimNextJob();
    if (!job) break; // queue drained

    const beat = setInterval(() => {
      void heartbeatJob(job.id);
    }, HEARTBEAT_MS);

    try {
      // The real pipeline. It inserts the gene_page_drafts row itself on
      // success (review_status = 'unreviewed'), which is what moves the gene
      // into the Unassigned queue.
      const result = await draftGenePage(service, job.geneSymbol, job.geneSlug);

      if (result.outcome === "ok") {
        // Link the job to the draft the pipeline just wrote, so the row can
        // deep-link to it. Looked up by slug because draftGenePage returns
        // the outcome, not the inserted row's id.
        const { data: draft } = await service
          .from("gene_page_drafts")
          .select("id")
          .eq("gene_slug", job.geneSlug)
          .order("generated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        await completeJob(job.id, draft?.id ?? null);
        processed.push({ gene: job.geneSymbol, outcome: "complete" });
      } else if (result.outcome === "rejected") {
        // A rejection is a real, expected outcome of the governance rules
        // (unknown source id, failed retrieval, schema violation) — not a
        // crash. It still surfaces as Failed with a Retry, because the gene
        // has no draft and a human may want to try again.
        await failJob(job.id, `Draft rejected: ${result.reasons.join("; ")}`);
        processed.push({ gene: job.geneSymbol, outcome: "rejected" });
      } else {
        await failJob(job.id, result.error);
        processed.push({ gene: job.geneSymbol, outcome: "failed" });
      }
    } catch (err) {
      await failJob(job.id, shortReason(err));
      processed.push({ gene: job.geneSymbol, outcome: "failed" });
    } finally {
      clearInterval(beat);
    }
  }

  // Out of budget but still work queued → start a fresh invocation and let
  // this one end. Without this, a 38-gene Run All would stop at whatever fit
  // in one function lifetime.
  if (await hasPendingWork()) {
    await triggerGenerationWorker();
  }

  return NextResponse.json({ ok: true, processed });
}
