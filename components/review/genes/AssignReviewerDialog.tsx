"use client";

// Assign a generated gene draft to an active reviewer.
//
// Accessibility: a real modal — focus moves in on open, Escape closes, Tab is
// trapped, and focus returns to the trigger on close. The portal's audience
// includes people using screen readers and keyboards exclusively, so this is
// the baseline rather than a nicety.

import { useEffect, useRef, useState } from "react";
import { assignDraftAction } from "@/app/review/actions";
import type { AssignableReviewer } from "@/lib/genes/controlCenter";

export default function AssignReviewerDialog({
  geneSymbol,
  draftId,
  reviewers,
  onClose,
  onAssigned,
}: {
  geneSymbol: string;
  draftId: string;
  reviewers: AssignableReviewer[];
  onClose: () => void;
  onAssigned: (reviewerName: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When reassigning over someone's real work the action refuses once and
  // returns the exact warning to show; confirming re-sends with `confirmed`.
  const [confirmWarning, setConfirmWarning] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    const previouslyFocused = document.activeElement as HTMLElement | null;
    return () => previouslyFocused?.focus?.();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const filtered = reviewers.filter((r) =>
    r.displayName.toLowerCase().includes(query.trim().toLowerCase())
  );

  async function submit(confirmed = false) {
    if (!selected) return;
    setBusy(true);
    setError(null);
    const res = await assignDraftAction({ draftId, reviewerId: selected, confirmed });
    setBusy(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.data?.requiresConfirmation) {
      setConfirmWarning(res.data.warning ?? "This reviewer has already started work on this gene.");
      return;
    }
    onAssigned(reviewers.find((r) => r.userId === selected)?.displayName ?? "the reviewer");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} role="presentation" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-title"
        className="relative w-full max-w-md rounded-xl border border-ink/10 bg-white shadow-lg"
      >
        <div className="border-b border-ink/10 px-5 py-4">
          <h2 id="assign-title" className="font-display text-lg font-semibold text-forest">
            Assign {geneSymbol}
          </h2>
        </div>

        {confirmWarning ? (
          <div className="px-5 py-4">
            <p className="text-sm text-ink/80">{confirmWarning}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmWarning(null)}
                className="h-9 rounded-md border border-ink/20 px-3 text-sm font-semibold text-ink/70 hover:bg-ink/[0.04]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submit(true)}
                disabled={busy}
                className="h-9 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-60"
              >
                {busy ? "Reassigning…" : "Reassign anyway"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 py-4">
              <label htmlFor="reviewer-search" className="sr-only">
                Search reviewers
              </label>
              <input
                id="reviewer-search"
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reviewers…"
                className="h-10 w-full rounded-md border border-ink/15 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-forest"
              />

              <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto" role="radiogroup" aria-label="Reviewers">
                {filtered.length === 0 && (
                  <li className="px-1 py-6 text-center text-sm text-ink/60">
                    {reviewers.length === 0
                      ? "No active reviewers yet. Invite one from My Team."
                      : "No reviewers match that search."}
                  </li>
                )}
                {filtered.map((r) => {
                  const active = selected === r.userId;
                  return (
                    <li key={r.userId}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSelected(r.userId)}
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition ${
                          active
                            ? "border-forest bg-mint/40"
                            : "border-transparent hover:bg-ink/[0.04]"
                        }`}
                      >
                        <span>
                          <span className="block text-sm font-semibold text-ink">{r.displayName}</span>
                          <span className="block text-xs text-ink/60">Reviewer</span>
                        </span>
                        <span className="text-xs text-ink/60">
                          {r.activeGenes} active {r.activeGenes === 1 ? "gene" : "genes"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {error && (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {error}
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-ink/10 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="h-9 rounded-md border border-ink/20 px-3 text-sm font-semibold text-ink/70 hover:bg-ink/[0.04]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submit(false)}
                disabled={!selected || busy}
                className="h-9 rounded-md bg-forest px-3 text-sm font-semibold text-white hover:bg-forest/90 disabled:opacity-50"
              >
                {busy ? "Assigning…" : "Assign"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
