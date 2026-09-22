"use client";

// Admin "Review & Publish" screen.
//
// Shows the EXACT version the reviewer approved — not the live draft — because
// that is what publication will make public. Where the two differ, the
// difference is surfaced rather than hidden: an administrator publishing
// medical content should never be surprised by what went live.
//
// There is deliberately no editing here. Publishing is not an editing
// opportunity; an administrator who wants changes sends it back, which starts
// a fresh review and produces a fresh approved snapshot.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reviewHref, publicHref } from "@/lib/reviewer/paths";
import StatusBadge from "@/components/review/ui/StatusBadge";
import {
  publishApprovedVersionAction,
  requestChangesFromScreenAction,
} from "@/app/review/(dashboard)/genes/[draftId]/publish/actions";
import type { PublicationDetail } from "@/lib/genes/publicationQueue";

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Render one content section's text, whatever shape it is in. The draft
 *  schema nests prose under differing keys per section, so this reads the
 *  common ones rather than assuming a single shape. */
function sectionText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(sectionText).filter(Boolean).join("\n\n");
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const key of ["text", "body", "content", "summary"]) {
      if (typeof o[key] === "string") return o[key] as string;
    }
    const parts = Object.values(o).map(sectionText).filter(Boolean);
    if (parts.length) return parts.join("\n\n");
  }
  return "";
}

const SECTIONS: { key: string; label: string }[] = [
  { key: "summaryCard", label: "Summary" },
  { key: "whatThisGeneMeans", label: "What this gene means" },
  { key: "howItMayAffectVision", label: "How it may affect vision" },
  { key: "whatIsKnown", label: "What is known" },
  { key: "whatIsUncertain", label: "What is uncertain" },
  { key: "whatYouCanDoNext", label: "What you can do next" },
  { key: "questionsForClinician", label: "Questions for a clinician" },
  { key: "forFamilyAndCaregivers", label: "For family and caregivers" },
  { key: "treatmentAndResearch", label: "Treatment and research" },
  { key: "clinicalTrialSummary", label: "Clinical trials" },
];

export default function PublicationReview({
  detail,
  canPublish,
  canApprove,
}: {
  detail: PublicationDetail;
  canPublish: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const content = (detail.content ?? {}) as Record<string, unknown>;
  const live = (detail.liveContent ?? {}) as Record<string, unknown>;

  // Does the live draft differ from what was approved? Only meaningful when a
  // snapshot exists; without one we have nothing to compare against.
  const drifted =
    detail.hasApprovedSnapshot &&
    SECTIONS.some((s) => sectionText(content[s.key]) !== sectionText(live[s.key]));

  const sources = Array.isArray(content.sources) ? (content.sources as unknown[]) : [];

  async function doPublish() {
    setBusy("publish");
    setError(null);
    const res = await publishApprovedVersionAction(detail.draftId);
    setBusy(null);
    setConfirming(false);
    if (!res.ok) {
      setError(res.blockers?.length ? res.blockers.join(" ") : res.error);
      return;
    }
    setDone(`${detail.geneSymbol} published.`);
    router.refresh();
  }

  async function doRequestChanges() {
    if (!note.trim()) {
      setError("Explain what needs to change so the reviewer knows what to do.");
      return;
    }
    setBusy("changes");
    setError(null);
    const res = await requestChangesFromScreenAction(detail.draftId, note);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRequesting(false);
    setNote("");
    setDone(`Sent back to ${detail.approvedByName ?? "the reviewer"}.`);
    router.refresh();
  }

  return (
    <div className="max-w-3xl">
      <Link
        href={reviewHref("/genes")}
        className="text-sm font-semibold text-ink/60 underline-offset-2 hover:text-forest hover:underline"
      >
        ← Genes
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-forest">{detail.geneSymbol}</h1>
          <p className="mt-1 text-sm text-ink/60">
            Approved by {detail.approvedByName ?? "a reviewer"} · {formatWhen(detail.approvedAt)}
          </p>
        </div>
        <StatusBadge status="Awaiting Publication" />
      </div>

      {done && (
        <p role="status" className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {done}{" "}
          <Link href={publicHref(`/genetic-insights/${detail.geneSlug}`)} className="font-semibold underline">
            View the live page
          </Link>
        </p>
      )}

      {/* Integrity notices — the reason this screen exists. */}
      {!detail.hasApprovedSnapshot && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>No approved snapshot on file.</strong> This gene was submitted before the portal
          began recording the exact approved version, so we can&apos;t prove what the reviewer signed
          off on. Send it back to be re-approved before publishing.
        </p>
      )}
      {drifted && (
        <p className="mt-4 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          <strong>The draft has changed since it was approved.</strong> Publishing will make the{" "}
          <em>approved</em> version live, shown below — not the current draft.
        </p>
      )}

      {/* Version context */}
      <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2 rounded-xl border border-ink/10 bg-white px-5 py-4 text-sm">
        <div>
          <dt className="text-ink/55">Currently live</dt>
          <dd className="font-semibold text-ink">
            {detail.currentlyPublishedVersion ? `Version ${detail.currentlyPublishedVersion}` : "Never published"}
          </dd>
        </div>
        <div>
          <dt className="text-ink/55">Will publish as</dt>
          <dd className="font-semibold text-ink">
            Version {(detail.currentlyPublishedVersion ?? 0) + 1}
          </dd>
        </div>
        <div>
          <dt className="text-ink/55">Sources cited</dt>
          <dd className="font-semibold text-ink">{sources.length}</dd>
        </div>
      </dl>

      {/* The approved content */}
      <section className="mt-6 space-y-5">
        <h2 className="text-base font-semibold text-ink">The approved version</h2>
        {SECTIONS.map((s) => {
          const text = sectionText(content[s.key]);
          if (!text) return null;
          return (
            <article key={s.key} className="rounded-xl border border-ink/10 bg-white p-5">
              <h3 className="text-sm font-bold uppercase tracking-wide text-ink/50">{s.label}</h3>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink">{text}</div>
            </article>
          );
        })}

        {sources.length > 0 && (
          <article className="rounded-xl border border-ink/10 bg-white p-5">
            <h3 className="text-sm font-bold uppercase tracking-wide text-ink/50">Sources</h3>
            <ol className="mt-2 space-y-1.5 text-sm text-ink/80">
              {sources.map((raw, i) => {
                const src = raw as Record<string, unknown>;
                const title = typeof src.title === "string" ? src.title : `Source ${i + 1}`;
                const url = typeof src.url === "string" ? src.url : null;
                return (
                  <li key={i}>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-forest underline-offset-2 hover:underline"
                      >
                        {title}
                      </a>
                    ) : (
                      title
                    )}
                  </li>
                );
              })}
            </ol>
          </article>
        )}
      </section>

      {error && (
        <p role="alert" className="mt-5 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="sticky bottom-0 mt-8 flex flex-wrap items-center gap-3 border-t border-ink/10 bg-cream/95 py-4 backdrop-blur">
        {canPublish && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy !== null || !detail.hasApprovedSnapshot}
            className="h-10 rounded-md bg-forest px-4 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-40"
          >
            {busy === "publish" ? "Publishing…" : "Publish"}
          </button>
        )}
        {canApprove && (
          <button
            type="button"
            onClick={() => setRequesting((v) => !v)}
            disabled={busy !== null}
            className="h-10 rounded-md border border-ink/20 px-4 text-sm font-semibold text-ink/80 hover:bg-ink/[0.04] disabled:opacity-40"
          >
            Request changes
          </button>
        )}
        <Link
          href={reviewHref(`/admin/genes/${detail.draftId}`)}
          className="text-sm font-semibold text-ink/60 underline-offset-2 hover:text-forest hover:underline"
        >
          Open full record
        </Link>
      </div>

      {requesting && (
        <div className="mt-4 rounded-xl border border-ink/10 bg-white p-5">
          <label htmlFor="change-note" className="block text-sm font-semibold text-ink">
            What needs to be updated?
          </label>
          <p className="mt-0.5 text-xs text-ink/55">
            {detail.approvedByName ?? "The reviewer"} will see this, and regains edit access.
          </p>
          <textarea
            id="change-note"
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-2 w-full rounded-md border border-ink/15 p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setRequesting(false)}
              className="h-9 rounded-md border border-ink/20 px-3 text-sm font-semibold text-ink/70 hover:bg-ink/[0.04]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={doRequestChanges}
              disabled={busy !== null}
              className="h-9 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-50"
            >
              {busy === "changes" ? "Sending…" : "Send back"}
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <PublishConfirm
          geneSymbol={detail.geneSymbol}
          onCancel={() => setConfirming(false)}
          onConfirm={doPublish}
        />
      )}
    </div>
  );
}

function PublishConfirm({
  geneSymbol,
  onCancel,
  onConfirm,
}: {
  geneSymbol: string;
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
        aria-labelledby="publish-title"
        className="relative w-full max-w-md rounded-xl border border-ink/10 bg-white p-5 shadow-lg"
      >
        <h2 id="publish-title" className="font-display text-lg font-semibold text-forest">
          Publish {geneSymbol}?
        </h2>
        <p className="mt-2 text-sm text-ink/75">
          This approved version will become the live gene page on RP Hope. The version currently
          published is kept in history.
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
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}
