"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A dotted-underline jargon term (the "e-textbook" pattern) that reveals its
 * definition in a small popover on click/tap. Two things make this actually
 * accessible rather than just visually nice:
 *
 * 1. The definition is ALWAYS present in the button's accessible name via a
 *    permanent `sr-only` span — a screen-reader user hears it the moment
 *    they reach the term, with no extra interaction required. The visual
 *    popover is a bonus for sighted users, not the only way to get it.
 * 2. Click-to-toggle, not hover — matches components/site/AboutMenu.tsx's
 *    interaction pattern exactly (same reasoning: hover is unusable on
 *    touch and unreliable for keyboard users, which matters most on a site
 *    built for people with vision loss).
 */
export default function GlossaryTerm({
  term,
  definition,
  children,
}: {
  term: string;
  definition: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-block">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-sm text-inherit underline decoration-forest/50 decoration-dotted decoration-2 underline-offset-4 transition-colors hover:decoration-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        {children}
        <span className="sr-only"> (definition: {definition})</span>
      </button>

      {open && (
        // Visual-only affordance for sighted users — the definition is
        // already in the button's accessible name above, so this doesn't
        // need its own accessibility-tree presence (and hiding it avoids a
        // screen reader announcing the same definition twice).
        <span
          aria-hidden="true"
          className="absolute left-0 top-full z-50 mt-2 w-64 max-w-[80vw] rounded-lg border border-ink/15 bg-white p-3 text-left text-sm font-normal normal-case leading-snug text-ink shadow-xl"
        >
          <strong className="block font-display text-forest">{term}</strong>
          <span className="mt-1 block">{definition}</span>
        </span>
      )}
    </span>
  );
}
