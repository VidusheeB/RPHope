"use client";

// Site-wide "before you continue" medical disclaimer, shown ONCE per browser —
// a returning visitor on the same computer is never asked again.
//
// Acknowledgement is stored two ways, and either one suppresses the gate:
//   1. localStorage — instant, works offline.
//   2. a cookie set SERVER-side by /api/disclaimer, with a one-year expiry.
// The cookie exists because Safari's tracking prevention caps script-writable
// storage (localStorage) at ~7 days of inactivity, which would otherwise bring
// the gate back for Safari/iOS visitors roughly once a week. A server-set
// cookie is not subject to that cap.
//
// It remains a UI preference, not medical data (same pattern as
// lib/voice/accessibilityPreferences.ts). Never blocks screen readers: it is
// absent from the DOM entirely until acknowledged, so nothing to skip past.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "rphope_disclaimer_ack";
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function hasAcknowledged(): boolean {
  try {
    if (window.localStorage.getItem(STORAGE_KEY)) return true;
  } catch {
    // localStorage unavailable (private mode / disabled) — fall through to the
    // cookie rather than treating it as "not acknowledged".
  }
  return document.cookie
    .split("; ")
    .some((row) => row.startsWith(`${STORAGE_KEY}=`));
}

export default function MedicalDisclaimerGate() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const acknowledgeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!hasAcknowledged()) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    acknowledgeRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        acknowledge();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      );
      if (focusable.length === 0) return;
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

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function acknowledge() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore quota/availability errors — the cookie below still records it
    }
    // Fire-and-forget: the long-lived cookie is what keeps Safari/iOS visitors
    // from being asked again in a week. Failure here is not worth blocking on.
    void fetch("/api/disclaimer", { method: "POST" }).catch(() => {});
    setOpen(false);
  }

  // Following a legal link must not leave the visitor reading that page from
  // behind a still-open modal. Close the gate WITHOUT recording consent —
  // acknowledgement is only ever recorded by the button below.
  function dismissForNavigation() {
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="disclaimer-overlay fixed inset-0 z-[110] grid place-items-center bg-ink/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="disclaimer-title"
        aria-describedby="disclaimer-body"
        className="max-w-lg rounded-xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <h2
          id="disclaimer-title"
          className="font-display text-2xl font-semibold text-ink"
        >
          Before You Continue
        </h2>

        <div
          id="disclaimer-body"
          className="mt-4 space-y-3 text-sm leading-relaxed text-ink/75"
        >
          <p>
            RP Hope provides general educational information and does not offer
            medical advice. Community posts reflect individual users&rsquo;
            views, and external links are not controlled or endorsed by RP Hope.
          </p>
          <p>
            By continuing, you acknowledge that you should consult a qualified
            professional before making medical or other important decisions.
          </p>
        </div>

        <p className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-forest">
          <Link
            href="/policies#disclaimer"
            onClick={dismissForNavigation}
            className="underline underline-offset-2"
          >
            Full Disclaimer
          </Link>
          <Link
            href="/policies#terms"
            onClick={dismissForNavigation}
            className="underline underline-offset-2"
          >
            Terms
          </Link>
          <Link
            href="/policies#privacy"
            onClick={dismissForNavigation}
            className="underline underline-offset-2"
          >
            Privacy Policy
          </Link>
        </p>

        <div className="mt-6 flex justify-end">
          <button
            ref={acknowledgeRef}
            type="button"
            onClick={acknowledge}
            className="rounded-md bg-forest px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            I Understand and Continue
          </button>
        </div>
      </div>
    </div>
  );
}
