"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "Quick read / Full page" control for a gene page.
 *
 * Progressive enhancement: the collapsible sections are native <details
 * class="gene-sec"> elements that already work with the keyboard and screen
 * readers on their own (each announces its expanded/collapsed state). This
 * control is a convenience layer that opens or closes ALL of them at once. If
 * JavaScript never runs, the sections still work individually.
 *
 * It operates on the sections by DOM query (they are server-rendered siblings),
 * scoped to the nearest ancestor marked data-gene-scope so two gene sections on
 * one page could never cross-toggle. State is kept honest: when a visitor
 * toggles an individual section, the segmented control reflects "all open",
 * "all closed", or a mixed state.
 */
export default function ReadingModeToggle() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  // null = mixed; true = all open (full page); false = all closed (quick read)
  const [allOpen, setAllOpen] = useState<boolean | null>(false);
  const [announce, setAnnounce] = useState("");

  function sections(): HTMLDetailsElement[] {
    const scope = rootRef.current?.closest("[data-gene-scope]") ?? document;
    return Array.from(scope.querySelectorAll<HTMLDetailsElement>("details.gene-sec"));
  }

  function syncFromDom() {
    const secs = sections();
    if (secs.length === 0) return;
    const open = secs.filter((s) => s.open).length;
    setAllOpen(open === secs.length ? true : open === 0 ? false : null);
  }

  useEffect(() => {
    const secs = sections();
    // Only surface the control when there is more than one section to govern.
    if (secs.length >= 2) setReady(true);
    syncFromDom();
    const onToggle = () => syncFromDom();
    secs.forEach((s) => s.addEventListener("toggle", onToggle));
    return () => secs.forEach((s) => s.removeEventListener("toggle", onToggle));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setMode(open: boolean) {
    sections().forEach((s) => {
      s.open = open;
    });
    setAllOpen(open);
    setAnnounce(
      open ? "Full page: all sections expanded." : "Quick read: sections collapsed to previews."
    );
  }

  // Render an empty ref anchor even before ready so the effect can locate the scope.
  return (
    <div ref={rootRef}>
      {ready && (
        <div className="sticky top-0 z-10 -mx-1 mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-ink/10 bg-cream px-1 py-2">
          <div className="inline-flex rounded-full bg-cream-card p-1" role="group" aria-label="Reading mode">
            <button
              type="button"
              aria-pressed={allOpen === false}
              onClick={() => setMode(false)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                allOpen === false ? "bg-white text-forest shadow-sm" : "text-ink/60 hover:text-ink"
              }`}
            >
              Quick read
            </button>
            <button
              type="button"
              aria-pressed={allOpen === true}
              onClick={() => setMode(true)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition ${
                allOpen === true ? "bg-white text-forest shadow-sm" : "text-ink/60 hover:text-ink"
              }`}
            >
              Full page
            </button>
          </div>
          <p className="text-sm text-ink/60">
            All sections are here — open any one, or switch to{" "}
            <span className="font-bold text-forest">Full page</span> to open them all.
          </p>
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
