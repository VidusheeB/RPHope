"use client";

// A real confirmation dialog, replacing window.confirm().
//
// window.confirm is unstyled, untranslatable, can't carry the context that
// makes a decision safe ("they have 3 genes in review"), and is suppressible
// by the browser. For an irreversible action on a medical content platform,
// the person needs to see what they are about to lose.
//
// Accessibility: focus moves in on open, Escape cancels, Tab is trapped, and
// focus returns to the trigger on close. A destructive dialog deliberately
// focuses CANCEL rather than the destructive button, so Enter doesn't delete.

import { useEffect, useRef } from "react";

export default function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Destructive dialogs open on Cancel so a stray Enter is harmless.
    (destructive ? cancelRef : confirmRef).current?.focus();
    return () => previouslyFocused?.focus?.();
  }, [destructive]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
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
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onCancel} role="presentation" />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className="relative w-full max-w-md rounded-xl border border-ink/10 bg-white p-5 shadow-lg"
      >
        <h2 id="confirm-title" className="font-display text-lg font-semibold text-forest">
          {title}
        </h2>
        <div id="confirm-body" className="mt-3 text-sm leading-relaxed text-ink/80">
          {children}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-9 rounded-md border border-ink/20 px-3 text-sm font-semibold text-ink/70 hover:bg-ink/[0.04] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`h-9 rounded-md px-3 text-sm font-semibold text-white disabled:opacity-50 ${
              destructive ? "bg-red-700 hover:bg-red-800" : "bg-forest hover:bg-forest/90"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
