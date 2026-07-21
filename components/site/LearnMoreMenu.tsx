"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// "Learn More" nav item — deliberately not a clickable link itself, only a
// dropdown trigger. Mirrors AboutMenu's click-to-toggle behavior (not hover:
// hover menus are unusable on touch and hostile to keyboard/screen-reader
// users).
const items = [
  { href: "/what-is-rp", label: "Understanding RP" },
  { href: "/future-therapies", label: "Future Therapies" },
  { href: "/what-is-a-clinical-trial", label: "What is a Clinical Trial" },
];

export default function LearnMoreMenu() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
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
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="learn-more-menu"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 border-b-2 border-transparent pb-0.5 font-semibold transition-colors hover:border-gold hover:text-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
      >
        Learn More
        <svg
          aria-hidden="true"
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          id="learn-more-menu"
          className="absolute left-0 top-full z-50 mt-3 min-w-[12rem] overflow-hidden rounded-lg border border-ink/15 bg-cream-header py-1 shadow-xl"
        >
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 font-semibold text-ink/80 transition-colors hover:bg-forest/5 hover:text-forest focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
