"use client";

// The Genes operations console.
//
// Tabs are workflow buckets, not filters over one list — a gene sits in
// exactly one, so the counts always sum to the catalog and "what needs doing"
// is answerable at a glance.
//
// Generation runs on the server (see app/api/genes/generation/drain). This
// component only enqueues and then POLLS, which is why a run keeps going when
// the admin navigates away: nothing about the work lives in this component's
// state.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reviewHref } from "@/lib/reviewer/paths";
import StatusBadge from "@/components/review/ui/StatusBadge";
import AssignReviewerDialog from "./AssignReviewerDialog";
import {
  runGenerationAction,
  runAllGenerationAction,
  retryGenerationAction,
} from "@/app/review/(dashboard)/genes/actions";
import type { GeneBucket, GeneControlRow, AssignableReviewer } from "@/lib/genes/controlCenter";
import type { QueueSummary, GenerationStatus } from "@/lib/genes/generationQueue";

const TABS: { id: GeneBucket | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "needs_generation", label: "Needs Generation" },
  { id: "unassigned", label: "Unassigned" },
  { id: "in_review", label: "In Review" },
  { id: "awaiting_publication", label: "Awaiting Publication" },
  { id: "published", label: "Published" },
  { id: "failed", label: "Failed" },
];

const BUCKET_LABEL: Record<GeneBucket, string> = {
  needs_generation: "Needs Generation",
  failed: "Failed",
  unassigned: "Unassigned",
  in_review: "In Review",
  awaiting_publication: "Awaiting Publication",
  published: "Published",
};

const GENERATION_LABEL: Record<GenerationStatus, string> = {
  queued: "Queued",
  running: "Running",
  complete: "Complete",
  failed: "Failed",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

type Toast = { id: number; message: string };

export default function GeneControlCenter({
  initialRows,
  reviewers,
  initialQueue,
  canGenerate,
  canAssign,
}: {
  initialRows: GeneControlRow[];
  reviewers: AssignableReviewer[];
  initialQueue: QueueSummary;
  canGenerate: boolean;
  canAssign: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [queue, setQueue] = useState(initialQueue);
  const [tab, setTab] = useState<GeneBucket | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ slugs: string[]; isAll: boolean } | null>(null);
  const [assigning, setAssigning] = useState<GeneControlRow | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [expandedError, setExpandedError] = useState<string | null>(null);
  // null = not yet checked. False means generation will fail on every gene,
  // so say so up front rather than after a queue full of failures.
  const [generationConfigured, setGenerationConfigured] = useState<boolean | null>(null);

  // Keep server-rendered data in sync after a router.refresh().
  useEffect(() => setRows(initialRows), [initialRows]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/genes/generation/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data?.config) setGenerationConfigured(Boolean(data.config.anthropicKey));
      } catch {
        // Leave it unknown rather than claiming a misconfiguration.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const toast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  // ---- Live polling while generation is in flight -------------------------
  // Polls only while there is active work, so an idle portal is quiet. The
  // status endpoint also re-kicks a stalled worker, so simply having this page
  // open is enough to recover a queue after a deploy or a crashed invocation.
  const pollingRef = useRef(false);
  useEffect(() => {
    if (!queue.active || pollingRef.current) return;
    pollingRef.current = true;
    let cancelled = false;

    async function tick() {
      while (!cancelled) {
        await new Promise((r) => setTimeout(r, 4000));
        if (cancelled) return;
        try {
          const res = await fetch("/api/genes/generation/status", { cache: "no-store" });
          if (!res.ok) continue;
          const data = await res.json();
          if (cancelled || !data.ok) continue;

          setQueue(data.summary as QueueSummary);
          if (data.config) setGenerationConfigured(Boolean(data.config.anthropicKey));
          setRows((prev) => {
            const live = new Map(
              (data.genes as { geneSlug: string; status: GenerationStatus | null; error: string | null; hasDraft: boolean; eligible: boolean }[]).map(
                (g) => [g.geneSlug, g]
              )
            );
            return prev.map((r) => {
              const g = live.get(r.geneSlug);
              if (!g) return r;
              return { ...r, generationStatus: g.status, generationError: g.error, eligible: g.eligible };
            });
          });

          if (!(data.summary as QueueSummary).active) {
            // Finished: pull the authoritative server render so newly
            // generated genes move into Unassigned with their draft ids.
            router.refresh();
            break;
          }
        } catch {
          // Network hiccup — keep polling.
        }
      }
      pollingRef.current = false;
    }
    void tick();
    return () => {
      cancelled = true;
      pollingRef.current = false;
    };
  }, [queue.active, router]);

  // ---- Derived ------------------------------------------------------------
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.bucket] = (c[r.bucket] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = useMemo(
    () => (tab === "all" ? rows : rows.filter((r) => r.bucket === tab)),
    [rows, tab]
  );

  // Only genes the server would actually accept can be selected — this mirrors
  // the server-side eligibility rule so the UI can't offer a run that will
  // silently come back as "skipped".
  const selectableInView = useMemo(() => visible.filter((r) => r.eligible), [visible]);
  const eligibleTotal = useMemo(() => rows.filter((r) => r.eligible).length, [rows]);

  const selectedSlugs = useMemo(
    () => selectableInView.filter((r) => selected.has(r.geneSlug)).map((r) => r.geneSlug),
    [selectableInView, selected]
  );

  const allVisibleSelected =
    selectableInView.length > 0 && selectedSlugs.length === selectableInView.length;

  function toggle(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) selectableInView.forEach((r) => next.delete(r.geneSlug));
      else selectableInView.forEach((r) => next.add(r.geneSlug));
      return next;
    });
  }

  // ---- Actions ------------------------------------------------------------
  async function doRun(slugs: string[], isAll: boolean) {
    setConfirming(null);
    setBusy(isAll ? "all" : "selected");
    const res = isAll ? await runAllGenerationAction() : await runGenerationAction(slugs);
    setBusy(null);

    if (!res.ok) {
      toast(res.error);
      return;
    }
    setSelected(new Set());
    if (res.queuedCount > 0) {
      toast(
        `Generation started for ${res.queuedCount} ${res.queuedCount === 1 ? "gene" : "genes"}.`
      );
      setQueue((q) => ({ ...q, queued: q.queued + res.queuedCount, active: true }));
    }
    // A partial run is never silently partial.
    if (res.skipped.length) {
      toast(`${res.skipped.length} skipped (already generated, queued or running).`);
    }
    router.refresh();
  }

  async function doRetry(slug: string) {
    setBusy(slug);
    const res = await retryGenerationAction(slug);
    setBusy(null);
    if (!res.ok) {
      toast(res.error);
      return;
    }
    toast(res.queuedCount ? "Retry queued." : "That gene is already queued.");
    setQueue((q) => ({ ...q, queued: q.queued + res.queuedCount, active: true }));
    router.refresh();
  }

  const showSelection = canGenerate && (tab === "needs_generation" || tab === "failed");

  return (
    <div>
      {/* ---- Page header ---- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest">Genes</h1>
          <p className="mt-1 text-sm text-ink/60">
            {rows.length} genes in the RP Hope catalogue · {eligibleTotal} ready to generate
          </p>
        </div>

        {canGenerate && (
          <div className="flex items-center gap-2">
            {showSelection && selectedSlugs.length > 0 && (
              <button
                type="button"
                onClick={() => setConfirming({ slugs: selectedSlugs, isAll: false })}
                disabled={busy !== null}
                className="h-9 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-60"
              >
                {busy === "selected" ? "Starting…" : `Run ${selectedSlugs.length} selected`}
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirming({ slugs: [], isAll: true })}
              disabled={busy !== null || eligibleTotal === 0}
              className="h-9 rounded-md border border-forest px-3 text-sm font-semibold text-forest hover:bg-mint/40 disabled:opacity-40"
            >
              {busy === "all" ? "Starting…" : "Run all"}
            </button>
          </div>
        )}
      </div>

      {canGenerate && generationConfigured === false && (
        <p
          role="alert"
          className="mt-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
        >
          <strong>Generation isn&apos;t configured on this deployment.</strong> ANTHROPIC_API_KEY is
          missing, so every gene will fail. Add it to this Vercel project&apos;s environment
          variables and redeploy — a renamed or newly added variable only takes effect on a new
          deployment.
        </p>
      )}

      {/* ---- Batch progress ---- */}
      {(queue.active || queue.failed > 0) && (
        <div className="mt-5 rounded-xl border border-ink/10 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Opus generation</h2>
            <p className="text-sm text-ink/70">
              {queue.complete} of {queue.complete + queue.running + queue.queued + queue.failed} complete
            </p>
          </div>
          {/* Real counts only — never a simulated model-progress percentage. */}
          <div
            className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-ink/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={queue.complete + queue.running + queue.queued + queue.failed}
            aria-valuenow={queue.complete}
            aria-label="Genes generated"
          >
            {(["complete", "running", "failed"] as const).map((k) => {
              const total = queue.complete + queue.running + queue.queued + queue.failed || 1;
              const cls =
                k === "complete" ? "bg-emerald-500" : k === "running" ? "bg-blue-500" : "bg-red-500";
              return (
                <div key={k} className={cls} style={{ width: `${(queue[k] / total) * 100}%` }} />
              );
            })}
          </div>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink/70">
            <span><dt className="inline font-semibold text-ink">{queue.complete}</dt> <dd className="inline">Complete</dd></span>
            <span><dt className="inline font-semibold text-ink">{queue.running}</dt> <dd className="inline">Running</dd></span>
            <span><dt className="inline font-semibold text-ink">{queue.queued}</dt> <dd className="inline">Queued</dd></span>
            <span><dt className="inline font-semibold text-ink">{queue.failed}</dt> <dd className="inline">Failed</dd></span>
          </dl>
          {queue.active && (
            <p className="mt-2 text-xs text-ink/55">
              Generation runs on the server — you can leave this page and come back.
            </p>
          )}
        </div>
      )}

      {/* ---- Tabs ---- */}
      <div className="mt-6 border-b border-ink/10">
        <nav className="-mb-px flex flex-wrap gap-1" aria-label="Gene workflow">
          {TABS.map((t) => {
            const count = counts[t.id] ?? 0;
            if (t.id === "failed" && count === 0) return null;
            const current = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={current ? "page" : undefined}
                className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-semibold transition ${
                  current
                    ? "border-forest text-forest"
                    : "border-transparent text-ink/60 hover:border-ink/20 hover:text-ink"
                }`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${current ? "bg-mint/60 text-forest" : "bg-ink/[0.07] text-ink/60"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ---- Select-all bar ---- */}
      {showSelection && selectableInView.length > 0 && (
        <div className="mt-3 flex items-center gap-3 rounded-md bg-ink/[0.03] px-3 py-2">
          <input
            id="select-all"
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleAllVisible}
            className="h-4 w-4 rounded border-ink/30 accent-[#234b43]"
          />
          <label htmlFor="select-all" className="text-sm text-ink/70">
            Select all {selectableInView.length} eligible
          </label>
          {selectedSlugs.length > 0 && (
            <span className="ml-auto text-sm font-semibold text-forest">
              {selectedSlugs.length} selected
            </span>
          )}
        </div>
      )}

      {/* ---- Rows ---- */}
      <ul className="mt-3 divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10 bg-white">
        {visible.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-ink/60">
            {tab === "awaiting_publication"
              ? "No genes are waiting for publication."
              : tab === "needs_generation"
                ? "Every gene in the catalogue has been generated."
                : "Nothing here yet."}
          </li>
        )}

        {visible.map((r) => {
          const gen = r.generationStatus;
          const inFlight = gen === "queued" || gen === "running";
          return (
            <li key={r.geneSlug} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {showSelection && (
                <input
                  type="checkbox"
                  checked={selected.has(r.geneSlug)}
                  onChange={() => toggle(r.geneSlug)}
                  disabled={!r.eligible}
                  aria-label={`Select ${r.geneSymbol}`}
                  className="h-4 w-4 rounded border-ink/30 accent-[#234b43] disabled:opacity-30"
                />
              )}

              <div className="min-w-[7rem]">
                {r.draftId ? (
                  <Link
                    href={reviewHref(`/admin/genes/${r.draftId}`)}
                    className="font-semibold text-forest underline-offset-2 hover:underline"
                  >
                    {r.geneSymbol}
                  </Link>
                ) : (
                  <span className="font-semibold text-ink">{r.geneSymbol}</span>
                )}
              </div>

              <StatusBadge status={inFlight || gen === "failed" ? GENERATION_LABEL[gen!] : BUCKET_LABEL[r.bucket]} />

              <div className="min-w-[9rem] text-sm text-ink/70">
                {r.assignedReviewerName ?? (r.bucket === "unassigned" ? "No reviewer assigned" : "—")}
              </div>

              <div className="text-xs text-ink/55">{relativeTime(r.updatedAt)}</div>

              <div className="ml-auto flex items-center gap-2">
                {gen === "failed" && (
                  <>
                    {r.generationError && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedError(expandedError === r.geneSlug ? null : r.geneSlug)
                        }
                        aria-expanded={expandedError === r.geneSlug}
                        className="text-xs font-semibold text-ink/60 underline-offset-2 hover:text-ink hover:underline"
                      >
                        {expandedError === r.geneSlug ? "Hide details" : "View details"}
                      </button>
                    )}
                    {canGenerate && (
                      <button
                        type="button"
                        onClick={() => doRetry(r.geneSlug)}
                        disabled={busy === r.geneSlug}
                        className="h-8 rounded-md border border-ink/20 px-2.5 text-xs font-semibold text-ink/80 hover:bg-ink/[0.04] disabled:opacity-50"
                      >
                        {busy === r.geneSlug ? "Queueing…" : "Retry"}
                      </button>
                    )}
                  </>
                )}

                {canAssign && r.bucket === "unassigned" && r.draftId && (
                  <button
                    type="button"
                    onClick={() => setAssigning(r)}
                    className="h-8 rounded-md bg-forest px-2.5 text-xs font-semibold text-white hover:bg-forest/90"
                  >
                    Assign reviewer
                  </button>
                )}

                {r.bucket === "awaiting_publication" && r.draftId && (
                  <Link
                    href={reviewHref(`/genes/${r.draftId}/publish`)}
                    className="h-8 rounded-md bg-forest px-2.5 text-xs font-semibold leading-8 text-white hover:bg-forest/90"
                  >
                    Review &amp; publish
                  </Link>
                )}
              </div>

              {expandedError === r.geneSlug && r.generationError && (
                <p className="w-full rounded-md bg-red-50 px-3 py-2 text-xs text-red-900">
                  {r.generationError}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {/* ---- Run confirmation ---- */}
      {confirming && (
        <RunConfirm
          count={confirming.isAll ? eligibleTotal : confirming.slugs.length}
          names={
            confirming.isAll
              ? []
              : confirming.slugs
                  .map((s) => rows.find((r) => r.geneSlug === s)?.geneSymbol ?? s)
                  .slice(0, 12)
          }
          onCancel={() => setConfirming(null)}
          onConfirm={() => doRun(confirming.slugs, confirming.isAll)}
        />
      )}

      {assigning && assigning.draftId && (
        <AssignReviewerDialog
          geneSymbol={assigning.geneSymbol}
          draftId={assigning.draftId}
          reviewers={reviewers}
          onClose={() => setAssigning(null)}
          onAssigned={(name) => {
            setAssigning(null);
            toast(`${assigning.geneSymbol} assigned to ${name}.`);
            router.refresh();
          }}
        />
      )}

      {/* ---- Toasts ---- */}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white shadow-lg"
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Confirmation before spending real Anthropic budget. Large runs get the
 *  full count; a small explicit selection also lists the genes, so an admin
 *  can see exactly what they're about to pay for. */
function RunConfirm({
  count,
  names,
  onCancel,
  onConfirm,
}: {
  count: number;
  names: string[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onCancel} role="presentation" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="run-title"
        className="relative w-full max-w-md rounded-xl border border-ink/10 bg-white p-5 shadow-lg"
      >
        <h2 id="run-title" className="font-display text-lg font-semibold text-forest">
          {count === 1 ? "Generate 1 gene draft?" : `Generate drafts for ${count} genes?`}
        </h2>
        {names.length > 0 && (
          <ul className="mt-3 max-h-40 space-y-0.5 overflow-y-auto text-sm text-ink/75">
            {names.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink/60">
          Each gene runs the full research pipeline and one Opus call. Drafts are saved for review
          and are never published automatically.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 rounded-md border border-ink/20 px-3 text-sm font-semibold text-ink/70 hover:bg-ink/[0.04]"
          >
            Cancel
          </button>
          <button
            ref={ref}
            type="button"
            onClick={onConfirm}
            className="h-9 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-forest/90"
          >
            {count === 1 ? "Run 1 gene" : `Run ${count} genes`}
          </button>
        </div>
      </div>
    </div>
  );
}
