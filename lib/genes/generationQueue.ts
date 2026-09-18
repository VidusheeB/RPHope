// Opus gene-generation queue — the data layer behind the portal's
// "Needs Generation" tab.
//
// Everything here is SERVICE-ROLE. gene_generation_jobs is deny-all under RLS
// (see 0025), so the capability check at the call site is the whole
// authorization boundary — every caller must have proven `genes.generate`
// (to enqueue/retry) or `genes.view_all` (to read state) first.
//
// The browser never generates anything. It enqueues rows; a server-side
// worker (app/api/genes/generation/drain) drains them. That is what makes a
// run survive the admin navigating away, and what makes one admin's run
// visible to every other admin instead of living in one tab's state.

import { getServiceSupabase } from "@/lib/supabaseAdmin";
import { geneGrid } from "@/lib/geneGrid";

export type GenerationStatus = "queued" | "running" | "complete" | "failed";

export type GenerationJob = {
  id: string;
  geneSlug: string;
  geneSymbol: string;
  status: GenerationStatus;
  batchId: string | null;
  attempts: number;
  error: string | null;
  draftId: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

/** One row of the Needs Generation / gene control-center view: the catalog
 *  gene, whether a draft already exists, and its most recent job (if any). */
export type GeneGenerationState = {
  geneSlug: string;
  geneSymbol: string;
  hasDraft: boolean;
  /** Most recent job for this gene, whatever its status. */
  latestJob: GenerationJob | null;
  /** True when this gene can be included in a Run Selected / Run All right
   *  now — no draft yet, and nothing queued or running for it. */
  eligible: boolean;
};

type JobRow = {
  id: string;
  gene_slug: string;
  gene_symbol: string;
  status: GenerationStatus;
  batch_id: string | null;
  attempts: number;
  error: string | null;
  draft_id: string | null;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
};

function toJob(r: JobRow): GenerationJob {
  return {
    id: r.id,
    geneSlug: r.gene_slug,
    geneSymbol: r.gene_symbol,
    status: r.status,
    batchId: r.batch_id,
    attempts: r.attempts,
    error: r.error,
    draftId: r.draft_id,
    queuedAt: r.queued_at,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
  };
}

const ACTIVE: GenerationStatus[] = ["queued", "running"];

/**
 * The full generation picture for every gene in the catalog.
 *
 * Eligibility is computed HERE and re-derived server-side at enqueue time —
 * never trusted from the client — so a stale tab offering a gene that has
 * since been generated can't sneak a duplicate run past us.
 */
export async function getGeneGenerationState(): Promise<GeneGenerationState[]> {
  const service = getServiceSupabase();
  if (!service) return [];

  const [{ data: drafts }, { data: jobs }] = await Promise.all([
    service.from("gene_page_drafts").select("gene_slug"),
    service
      .from("gene_generation_jobs")
      .select("id, gene_slug, gene_symbol, status, batch_id, attempts, error, draft_id, queued_at, started_at, finished_at")
      .order("queued_at", { ascending: false }),
  ]);

  const draftedSlugs = new Set((drafts ?? []).map((d) => d.gene_slug));

  // Jobs come back newest-first, so the first one seen per gene is the latest.
  const latestByGene = new Map<string, GenerationJob>();
  for (const row of (jobs ?? []) as JobRow[]) {
    if (!latestByGene.has(row.gene_slug)) latestByGene.set(row.gene_slug, toJob(row));
  }

  return geneGrid.map((g) => {
    const latestJob = latestByGene.get(g.slug) ?? null;
    const hasDraft = draftedSlugs.has(g.slug);
    const isActive = latestJob ? ACTIVE.includes(latestJob.status) : false;
    return {
      geneSlug: g.slug,
      geneSymbol: g.display,
      hasDraft,
      latestJob,
      eligible: !hasDraft && !isActive,
    };
  });
}

/** Genes that may be generated right now — what "Run All" means. */
export async function getEligibleGenes(): Promise<GeneGenerationState[]> {
  return (await getGeneGenerationState()).filter((g) => g.eligible);
}

export type EnqueueResult = {
  batchId: string;
  queued: { geneSlug: string; geneSymbol: string }[];
  /** Genes asked for but not enqueued, with why — shown to the admin so a
   *  partial run is never silently partial. */
  skipped: { geneSlug: string; reason: string }[];
};

/**
 * Enqueue generation for specific genes.
 *
 * Re-derives eligibility from the database rather than trusting the posted
 * list, then relies on the partial unique index (0025) as the real race
 * guard: if two admins press Run at the same instant, one INSERT wins and the
 * other comes back as a unique violation, which is reported as "already
 * queued" rather than failing the whole batch.
 */
export async function enqueueGeneGeneration(
  geneSlugs: string[],
  requestedBy: string | null
): Promise<EnqueueResult> {
  const service = getServiceSupabase();
  const batchId = crypto.randomUUID();
  if (!service) return { batchId, queued: [], skipped: geneSlugs.map((s) => ({ geneSlug: s, reason: "Server not configured." })) };

  const state = await getGeneGenerationState();
  const byslug = new Map(state.map((s) => [s.geneSlug, s]));

  const queued: EnqueueResult["queued"] = [];
  const skipped: EnqueueResult["skipped"] = [];

  for (const slug of Array.from(new Set(geneSlugs))) {
    const g = byslug.get(slug);
    if (!g) {
      skipped.push({ geneSlug: slug, reason: "Not a gene in the RP Hope catalog." });
      continue;
    }
    if (!g.eligible) {
      skipped.push({
        geneSlug: slug,
        reason: g.hasDraft ? "Already generated." : "Already queued or running.",
      });
      continue;
    }

    const { error } = await service.from("gene_generation_jobs").insert({
      gene_slug: g.geneSlug,
      gene_symbol: g.geneSymbol,
      status: "queued",
      requested_by: requestedBy,
      batch_id: batchId,
    });

    if (error) {
      // 23505 = unique_violation on gene_generation_jobs_one_active_per_gene:
      // somebody else enqueued this gene between our read and our write. That
      // is the index doing its job, not an error worth failing the batch over.
      const alreadyActive = (error as { code?: string }).code === "23505";
      skipped.push({
        geneSlug: slug,
        reason: alreadyActive ? "Already queued or running." : error.message,
      });
      continue;
    }
    queued.push({ geneSlug: g.geneSlug, geneSymbol: g.geneSymbol });
  }

  return { batchId, queued, skipped };
}

/** Requeue a failed gene. Distinct from enqueue because a failed gene has no
 *  active job (so it's eligible) but DOES need its prior failure preserved in
 *  history rather than overwritten. */
export async function retryGeneGeneration(
  geneSlug: string,
  requestedBy: string | null
): Promise<EnqueueResult> {
  return enqueueGeneGeneration([geneSlug], requestedBy);
}

/** Atomically take the next queued job. Returns null when the queue is
 *  empty. Safe to call from several worker invocations at once. */
export async function claimNextJob(): Promise<GenerationJob | null> {
  const service = getServiceSupabase();
  if (!service) return null;
  const { data, error } = await service.rpc("claim_next_generation_job");
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = (Array.isArray(data) ? data[0] : data) as JobRow;
  return toJob(row);
}

export async function heartbeatJob(jobId: string): Promise<void> {
  const service = getServiceSupabase();
  if (!service) return;
  await service
    .from("gene_generation_jobs")
    .update({ heartbeat_at: new Date().toISOString() })
    .eq("id", jobId);
}

export async function completeJob(jobId: string, draftId: string | null): Promise<void> {
  const service = getServiceSupabase();
  if (!service) return;
  await service
    .from("gene_generation_jobs")
    .update({
      status: "complete",
      draft_id: draftId,
      finished_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", jobId);
}

/** Mark a job failed with a SHORT operator-facing reason. Model traces and
 *  stack dumps are deliberately not stored — the queue UI shows a sentence
 *  and a Retry, not a wall of text. */
export async function failJob(jobId: string, reason: string): Promise<void> {
  const service = getServiceSupabase();
  if (!service) return;
  await service
    .from("gene_generation_jobs")
    .update({
      status: "failed",
      finished_at: new Date().toISOString(),
      error: reason.slice(0, 500),
    })
    .eq("id", jobId);
}

export type QueueSummary = {
  queued: number;
  running: number;
  complete: number;
  failed: number;
  /** True when the worker has something left to do. */
  active: boolean;
};

/** Counts across the whole queue, or one batch. Drives the progress readout
 *  ("12 of 38 complete") and the poll that stops once nothing is active. */
export async function getQueueSummary(batchId?: string): Promise<QueueSummary> {
  const service = getServiceSupabase();
  const empty: QueueSummary = { queued: 0, running: 0, complete: 0, failed: 0, active: false };
  if (!service) return empty;

  let q = service.from("gene_generation_jobs").select("status");
  if (batchId) q = q.eq("batch_id", batchId);
  const { data } = await q;
  if (!data) return empty;

  const summary = { ...empty };
  for (const r of data as { status: GenerationStatus }[]) summary[r.status] += 1;
  summary.active = summary.queued > 0 || summary.running > 0;
  return summary;
}

/** True when there is work waiting — used to decide whether a page load or a
 *  status poll should kick the worker back into life. */
export async function hasPendingWork(): Promise<boolean> {
  const service = getServiceSupabase();
  if (!service) return false;
  const { count } = await service
    .from("gene_generation_jobs")
    .select("id", { count: "exact", head: true })
    .in("status", ACTIVE);
  return (count ?? 0) > 0;
}
