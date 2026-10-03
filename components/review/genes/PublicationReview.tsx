"use client";

// The final step before a gene page goes live.
//
// It concludes TWO DIFFERENT KINDS OF REVIEW, and says which it is:
//
//   * OWN REVIEW — an admin reviewed a gene themselves and pressed "Complete
//     review and publish" in the editor. Nobody else is involved, so there is
//     nothing to approve and nobody to send it back to. This screen is simply
//     the last look: the finished page, then Publish.
//
//   * SOMEONE ELSE'S REVIEW — a reviewer submitted their work for publication.
//     The admin is now judging that work, so the screen leads with the review
//     itself (flags raised, how each was dispositioned, the reviewer's notes,
//     open tickets) and offers Request changes alongside Publish.
//
// In both cases the content is rendered with PreviewTab — the SAME components
// the public gene page uses — rather than a hand-drawn approximation. A
// preview that differs from the real page is worse than no preview, because it
// teaches you to approve something you have not actually seen.
//
// No editing happens here. Publishing is the moment you stop changing things;
// "Back to review" returns to the editor if something needs fixing.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { reviewHref, publicHref } from "@/lib/reviewer/paths";
import PreviewTab from "@/components/review/gene-admin/PreviewTab";
import {
  publishOwnReviewAction,
  publishSubmittedReviewAction,
  requestChangesFromScreenAction,
} from "@/app/review/(dashboard)/genes/[draftId]/publish/actions";
import type { PublicationDetail } from "@/lib/genes/publicationQueue";
import type { Article } from "@/components/site/GeneArticles";
import type { FlagResolutionStatus } from "@/lib/reviewer/publishGate";

function formatWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Typed against the real enum, so adding a status is a compile error here
// rather than a silently unlabelled row. An earlier draft of this map used
// guessed keys that matched none of the real statuses.
const STATUS_LABEL: Record<FlagResolutionStatus, string> = {
  unresolved: "Unresolved",
  wording_confirmed: "Wording confirmed",
  edited_and_resolved: "Edited and resolved",
  not_applicable: "Not applicable",
};

export default function PublicationReview({
  detail,
  articles,
  isOwnReview,
  canPublish,
  canRequestChanges,
}: {
  detail: PublicationDetail;
  articles: Article[];
  /** True when the viewer is concluding their OWN review rather than
   *  dispositioning someone else's. Changes the framing and controls. */
  isOwnReview: boolean;
  canPublish: boolean;
  canRequestChanges: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"publish" | "changes" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  async function doPublish() {
    setBusy("publish");
    setError(null);
    // Two different reviews end here, so two different server paths: an own
    // review publishes directly; someone else's submission is approved (if
    // it isn't already) and then published.
    const res = isOwnReview
      ? await publishOwnReviewAction(detail.draftId)
      : await publishSubmittedReviewAction(detail.draftId);
    setBusy(null);
    setConfirming(false);
    if (!res.ok) {
      setError(res.blockers?.length ? [res.error, ...res.blockers].join(" ") : res.error);
      return;
    }
    setPublished(true);
    router.refresh();
  }

  async function doRequestChanges() {
    if (!note.trim()) {
      setError("Say what needs to change, so the reviewer knows what to do.");
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
    router.push(reviewHref("/genes"));
  }

  const liveUrl = publicHref(`/genetic-insights/${detail.geneSlug}`);

  if (published) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center">
        <h1 className="font-display text-2xl font-semibold text-forest">{detail.geneSymbol} is live</h1>
        <p className="mt-2 text-sm text-ink/70">
          The page is now public on RP Hope
          {detail.currentlyPublishedVersion ? `, replacing version ${detail.currentlyPublishedVersion}` : ""}.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 rounded-md bg-forest px-4 text-sm font-semibold leading-10 text-white hover:bg-forest/90"
          >
            View the live page
          </a>
          <Link
            href={reviewHref("/genes")}
            className="h-10 rounded-md border border-ink/20 px-4 text-sm font-semibold leading-10 text-ink/80 hover:bg-ink/[0.04]"
          >
            Back to Genes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        href={isOwnReview ? reviewHref(`/${detail.draftId}`) : reviewHref("/genes")}
        className="text-sm font-semibold text-ink/60 underline-offset-2 hover:text-forest hover:underline"
      >
        {isOwnReview ? "← Back to review" : "← Genes"}
      </Link>

      <div className="mt-3">
        <h1 className="font-display text-2xl font-semibold text-forest">{detail.geneSymbol}</h1>
        <p className="mt-1 text-sm text-ink/65">
          {isOwnReview
            ? "Final check. This is exactly what the public will see — scroll to the bottom to publish."
            : `Submitted for publication by ${detail.approvedByName ?? "a reviewer"}${
                detail.approvedAt ? ` · ${formatWhen(detail.approvedAt)}` : ""
              }`}
        </p>
      </div>

      {/* The review behind this version — shown when judging someone else's
          work, since that is the thing being decided on. Omitted for an own
          review: the admin just did it, and repeating it back is noise. */}
      {!isOwnReview && (
        <section className="mt-6 rounded-xl border border-ink/10 bg-white p-5">
          <h2 className="text-base font-semibold text-ink">The review</h2>
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
            <div>
              <dt className="text-ink/55">Flags resolved</dt>
              <dd className="font-semibold text-ink">
                {detail.resolvedFlagCount} of {detail.flagCount}
              </dd>
            </div>
            <div>
              <dt className="text-ink/55">Open tickets</dt>
              <dd className={`font-semibold ${detail.openTicketCount ? "text-orange-800" : "text-ink"}`}>
                {detail.openTicketCount}
              </dd>
            </div>
            <div>
              <dt className="text-ink/55">Currently live</dt>
              <dd className="font-semibold text-ink">
                {detail.currentlyPublishedVersion ? `Version ${detail.currentlyPublishedVersion}` : "Never published"}
              </dd>
            </div>
          </dl>

          {detail.reviewNotes.length > 0 && (
            <ul className="mt-4 space-y-2 border-t border-ink/10 pt-4">
              {detail.reviewNotes.map((n, i) => (
                <li key={i} className="text-sm">
                  <p className="text-ink/80">{n.flag}</p>
                  <p className="mt-0.5 text-xs">
                    <span className="font-semibold text-ink">
                      {STATUS_LABEL[n.status as FlagResolutionStatus] ?? n.status}
                    </span>
                    {n.note && <span className="text-ink/65"> — “{n.note}”</span>}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* The page itself, rendered with the public site's own components. */}
      <section className="mt-6">
        {detail.content ? (
          <PreviewTab
            draft={detail.content}
            geneSlug={detail.geneSlug}
            articles={articles}
            hasPublishedVersion={Boolean(detail.currentlyPublishedVersion)}
          />
        ) : (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            This gene has no content to preview.
          </p>
        )}
      </section>

      {error && (
        <p role="alert" className="mt-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* Reached by scrolling past the whole page, on purpose. */}
      <section className="mt-8 rounded-xl border border-ink/10 bg-white p-5">
        <h2 className="text-base font-semibold text-ink">
          {isOwnReview ? "Publish this page" : "Decide on this review"}
        </h2>
        <p className="mt-1 text-sm text-ink/65">
          {detail.currentlyPublishedVersion
            ? `Publishing replaces version ${detail.currentlyPublishedVersion}, which is kept in history.`
            : "This will be the first published version of this gene."}
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {canPublish && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={busy !== null || !detail.content}
              className="h-10 rounded-md bg-forest px-5 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-40"
            >
              {busy === "publish" ? "Publishing…" : "Publish"}
            </button>
          )}
          {/* You cannot send your own review back to yourself. */}
          {!isOwnReview && canRequestChanges && (
            <button
              type="button"
              onClick={() => setRequesting((v) => !v)}
              disabled={busy !== null}
              className="h-10 rounded-md border border-ink/20 px-5 text-sm font-semibold text-ink/80 hover:bg-ink/[0.04] disabled:opacity-40"
            >
              Request changes
            </button>
          )}
        </div>

        {requesting && (
          <div className="mt-4">
            <label htmlFor="change-note" className="block text-sm font-semibold text-ink">
              What needs to be updated?
            </label>
            <p className="mt-0.5 text-xs text-ink/55">
              {detail.approvedByName ?? "The reviewer"} will see this and can edit the gene again.
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
      </section>

      {confirming && (
        <PublishConfirm geneSymbol={detail.geneSymbol} onCancel={() => setConfirming(false)} onConfirm={doPublish} />
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
          This page will go live on RP Hope immediately.
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
