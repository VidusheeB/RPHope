// A persistent record of what the gene-page pipeline has actually cost.
//
// The CLI already prints per-gene and cumulative cost, but only for the run in
// front of you — across a library drafted in batches over days, there was no
// way to answer "what has this cost us so far?" without scrolling back through
// terminal history. This appends one line per Opus call to a JSONL ledger that
// survives between runs.
//
// Every BILLED call is recorded, including rejected and failed ones: a draft
// that was generated and then thrown out for citing an unknown source still
// cost real money, and an expense record that hides those understates the true
// cost of the run.
//
// Written to gene-review-scratch/ (gitignored), matching where the retrieval
// diagnostics go. Nothing here is secret — commit the file if you want a
// permanent record for the org's books.

import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";

export const SPEND_LOG_PATH = "gene-review-scratch/spend-log.jsonl";

export type SpendEntry = {
  /** ISO timestamp of the call. */
  at: string;
  gene: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** Whether the draft was kept. Rejected/failed calls were still billed. */
  outcome: "ok" | "rejected" | "failed";
  /** True when the amount is apportioned rather than read from real usage —
   *  only used to backfill spend from before this ledger existed. The total
   *  stays accurate; the per-gene split is an estimate. */
  estimated?: boolean;
  note?: string;
};

/** Append one billed call. Never throws — a ledger write must not sink a run
 *  that already spent the money. */
export function recordSpend(entry: SpendEntry, path = SPEND_LOG_PATH): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(entry) + "\n", "utf8");
  } catch (err) {
    console.warn(`  [spend-log] could not record spend: ${(err as Error).message}`);
  }
}

export function readSpendLog(path = SPEND_LOG_PATH): SpendEntry[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as SpendEntry];
      } catch {
        return []; // a torn final line from an interrupted run
      }
    });
}

export type SpendSummary = {
  totalUsd: number;
  calls: number;
  genes: number;
  /** Spend that produced no usable draft — the waste figure worth watching. */
  wastedUsd: number;
  byOutcome: Record<SpendEntry["outcome"], { calls: number; usd: number }>;
  firstAt?: string;
  lastAt?: string;
};

export function summarizeSpend(entries: SpendEntry[]): SpendSummary {
  const byOutcome: SpendSummary["byOutcome"] = {
    ok: { calls: 0, usd: 0 },
    rejected: { calls: 0, usd: 0 },
    failed: { calls: 0, usd: 0 },
  };
  let totalUsd = 0;
  for (const e of entries) {
    totalUsd += e.costUsd;
    const bucket = byOutcome[e.outcome];
    if (bucket) {
      bucket.calls += 1;
      bucket.usd += e.costUsd;
    }
  }
  const times = entries.map((e) => e.at).sort();
  return {
    totalUsd,
    calls: entries.length,
    genes: new Set(entries.map((e) => e.gene)).size,
    wastedUsd: byOutcome.rejected.usd + byOutcome.failed.usd,
    byOutcome,
    firstAt: times[0],
    lastAt: times[times.length - 1],
  };
}

/** Human-readable summary, printed at the end of every run and by
 *  `npm run gene-pages:spend`. */
export function formatSpendSummary(s: SpendSummary, remainingGenes?: number): string {
  if (s.calls === 0) return "No billed calls recorded yet.";
  const lines = [
    `  total spent:     $${s.totalUsd.toFixed(2)}  (${s.calls} billed call(s) across ${s.genes} gene(s))`,
    `    kept:          $${s.byOutcome.ok.usd.toFixed(2)} (${s.byOutcome.ok.calls})`,
  ];
  if (s.wastedUsd > 0) {
    lines.push(
      `    no draft kept: $${s.wastedUsd.toFixed(2)} (${
        s.byOutcome.rejected.calls + s.byOutcome.failed.calls
      } rejected/failed — billed anyway)`
    );
  }
  // Project from the cost of drafts we actually KEPT, not from total spend
  // divided by genes touched. The latter folds one-off wasted spend (a bug that
  // rejected five drafts, since fixed) into the per-gene rate forever, and
  // overstated the remaining cost by roughly double.
  const keptGenes = s.byOutcome.ok.calls;
  const perKept = keptGenes > 0 ? s.byOutcome.ok.usd / keptGenes : 0;
  lines.push(`  cost per kept draft: $${perKept.toFixed(3)}  (${keptGenes} kept)`);
  if (s.wastedUsd > 0) {
    lines.push(
      `  (all-in average incl. discarded work: $${(s.totalUsd / s.genes).toFixed(3)}/gene)`
    );
  }
  if (remainingGenes && remainingGenes > 0 && perKept > 0) {
    lines.push(
      `  projected:       ~$${(perKept * remainingGenes).toFixed(2)} more for the remaining ${remainingGenes} gene(s)`
    );
  }
  if (s.firstAt) lines.push(`  period:          ${s.firstAt.slice(0, 10)} → ${s.lastAt?.slice(0, 10)}`);
  return lines.join("\n");
}
