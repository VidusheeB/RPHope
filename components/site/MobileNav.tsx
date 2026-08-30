"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV, ABOUT_ITEMS, LEARN_MORE_ITEMS } from "@/lib/nav";

// Mobile navigation. Shown only below the `md` breakpoint, where the desktop
// link row is hidden.
//
// Accessibility is the point of this site, so the menu is a real disclosure
// rather than a styled div: the trigger is a <button> with aria-expanded and
// aria-controls, the panel is a labelled <nav> containing lists, Escape closes
// it and returns focus to the trigger, focus moves into the panel on open, and
// focus is kept inside the panel while it is open. Every target is at least
// 44px. Nothing here depends on hover.

export default function MobileNav() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Navigating closes the menu. Without this it stays open over the new page.
  // Focus is NOT pulled back to the trigger here — the user is moving to a new
  // page, and yanking focus backwards would fight the browser.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes; Tab is kept within the panel while it is open.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      // Wrap around, so Tab cannot escape into the page behind the panel.
      if (e.shiftKey && (active === first || active === buttonRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  // Stop the page behind the panel scrolling under it.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Move focus into the panel once it opens.
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>("a[href], button");
    first?.focus();
  }, [open]);

  const linkClass =
    "flex min-h-[44px] items-center rounded-md px-3 py-2 text-base font-semibold text-ink/80 hover:bg-forest/5 hover:text-forest";

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="mobile-nav-panel"
        className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-forest/30 text-forest hover:bg-forest/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
      >
        {/* Text label for assistive tech; the bars are decorative. */}
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <svg
          aria-hidden="true"
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>

      {open && (
        <>
          {/* Tapping outside closes. Decorative, so it is hidden from assistive
              tech — Escape and the Close button are the accessible routes. */}
          <div
            className="fixed inset-0 top-[4.5rem] z-40 bg-ink/30"
            aria-hidden="true"
            onClick={() => close(false)}
          />

          <div
            id="mobile-nav-panel"
            ref={panelRef}
            className="fixed inset-x-0 top-[4.5rem] z-50 max-h-[calc(100vh-4.5rem)] overflow-y-auto border-b border-ink/10 bg-cream-header shadow-lg"
          >
            <nav aria-label="Primary, mobile" className="px-4 py-4">
              <ul className="flex flex-col gap-1">
                {PRIMARY_NAV.map((n) => (
                  <li key={n.href}>
                    <Link href={n.href} className={linkClass}>
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {/* The desktop dropdowns, flattened: a nested dropdown inside a
                  mobile menu is fiddly on touch and adds nothing here. */}
              <MobileSection title="About" items={ABOUT_ITEMS} linkClass={linkClass} />
              <MobileSection title="Learn More" items={LEARN_MORE_ITEMS} linkClass={linkClass} />

              <div className="mt-4 border-t border-ink/10 pt-4">
                <Link
                  href="/share-your-story"
                  className="flex min-h-[44px] items-center justify-center rounded-md border border-forest/30 px-5 py-2.5 font-semibold text-forest hover:bg-forest/5"
                >
                  Share your story
                </Link>
              </div>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}

function MobileSection({
  title,
  items,
  linkClass,
}: {
  title: string;
  items: { href: string; label: string }[];
  linkClass: string;
}) {
  return (
    <div className="mt-4 border-t border-ink/10 pt-4">
      <h2 className="px-3 text-xs font-bold uppercase tracking-widest text-forest/70">
        {title}
      </h2>
      <ul className="mt-1 flex flex-col gap-1">
        {items.map((n) => (
          <li key={n.href}>
            <Link href={n.href} className={linkClass}>
              {n.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
