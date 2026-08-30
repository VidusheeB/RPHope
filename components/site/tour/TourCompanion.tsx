"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TOUR_STEPS, type TourStep } from "@/lib/tour/steps";
import { speak, cancelSpeech, isTTSAvailable } from "@/lib/speech";

// The guided demo tour. A single self-contained client component that overlays
// the real site. Mounted only when NEXT_PUBLIC_TOUR_MODE is on (the demo
// deployment), never on the live site.
//
// Interaction model (kiosk, one visitor at a time):
//   1. Full-screen "Welcome" — the only way forward is Start the tour.
//   2. Each stop opens a centered modal explaining the page. The visitor closes
//      it (X / "Got it" / Escape) and explores the real page freely.
//   3. Reaching the bottom of the page reveals a "Next stop" button.
//   4. Failing that, after 2 minutes a POLITE, NON-MODAL toast offers the next
//      stop. It never steals focus (WCAG 2.2.4 — a timed interruption must not
//      hijack someone mid-read) and is dismissible.
//   5. Full-screen "Thanks", which loops back to the Welcome.
//
// Navigation is client-side (router.push), so this component stays mounted and
// keeps its place. A full page reload resets to Welcome on purpose — the clean
// "next visitor" state for a kiosk.

const TOTAL = TOUR_STEPS.length;
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Delivery for the Audio Tour narration — livelier and more expressive than the
// gene-page read-aloud (which stays warm/calm). `gpt-4o-mini-tts` takes its pace
// and emotion from `instructions`; a small client-side playbackRate nudge adds a
// touch more speed without the pitch artifacts of a high rate.
const TOUR_TTS_INSTRUCTIONS =
  "Speak like a warm, upbeat guide who genuinely loves helping people — lively, " +
  "expressive, and caring, with natural emotional inflection and real energy, never " +
  "flat or robotic. Keep a brisk, engaging pace. Read gene symbols letter by letter.";
const TOUR_TTS_RATE = 1.08;
// Same voice as the "Talk to Hope" assistant, so the two feel like one guide.
const TOUR_TTS_VOICE = "marin";

// Event the tour fires on every stop change so the live voice conversation
// (if any) ends — a visitor moving on shouldn't carry an open mic session
// into the next stop. The voice assistant listens for this.
export const TOUR_ADVANCE_EVENT = "rphope:tour-advance";

export default function TourCompanion() {
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(true);
  const [ended, setEnded] = useState(false);
  // Audio tour: once the visitor picks "Audio Tour", each stop's narration is
  // read aloud (OpenAI TTS) as they arrive. `ttsOk` gates the option on the key
  // being configured; `speaking` drives the floating Stop control.
  const [audioMode, setAudioMode] = useState(false);
  const [ttsOk, setTtsOk] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  // Index of a stop we've navigated toward but not yet arrived at. Its modal is
  // held closed until the destination page loads, so the modal never flashes
  // over the previous page mid-navigation.
  const navPendingRef = useRef<number | null>(null);

  useEffect(() => {
    setMounted(true);
    isTTSAvailable().then(setTtsOk);
    return () => cancelSpeech();
  }, []);

  const step: TourStep = TOUR_STEPS[index];
  const next = TOUR_STEPS[index + 1];
  const isDialog = step.kind === "welcome" || step.kind === "finish" || modalOpen;

  // Read a stop's narration (title + body) aloud — lively, expressive delivery.
  const speakStop = useCallback((s: TourStep) => {
    setSpeaking(true);
    speak(`${s.title}. ${s.body}`, {
      voice: TOUR_TTS_VOICE,
      instructions: TOUR_TTS_INSTRUCTIONS,
      rate: TOUR_TTS_RATE,
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }, []);

  const stopAudio = useCallback(() => {
    cancelSpeech();
    setSpeaking(false);
  }, []);

  // Move to a step, reset its per-page state, and navigate if it lives elsewhere.
  const goTo = useCallback(
    (target: number) => {
      const clamped = Math.min(Math.max(target, 0), TOTAL - 1);
      const dest = TOUR_STEPS[clamped];
      setIndex(clamped);
      // Moving to another stop ends any live voice conversation.
      window.dispatchEvent(new CustomEvent(TOUR_ADVANCE_EVENT));
      cancelSpeech();
      setSpeaking(false);
      const navigating = !!dest.href && dest.href !== pathname;
      if (navigating) {
        // Keep the modal closed until we land on the destination page — the
        // arrival effect opens it there, so it never flashes over this page.
        setModalOpen(false);
        navPendingRef.current = clamped;
        router.push(dest.href!);
      } else {
        // Same page (e.g. the home stop): show the modal now. In audio mode the
        // narration plays with a caption instead, so no modal.
        navPendingRef.current = null;
        setModalOpen(!audioMode);
      }
      // Read the stop aloud HERE — inside the click gesture — so the browser's
      // autoplay policy permits playback. An effect-initiated play() runs outside
      // the gesture and gets silently blocked (caption shows, but no sound).
      if (audioMode && ttsOk && dest.kind !== "welcome") speakStop(dest);
    },
    [pathname, router, audioMode, ttsOk, speakStop]
  );

  // Open a navigated stop's modal only once its destination page has loaded
  // (reading mode). This is what prevents the previous page from flashing behind
  // the modal during the route change.
  useEffect(() => {
    const pending = navPendingRef.current;
    if (pending === null) return;
    const dest = TOUR_STEPS[pending];
    if (dest.href && pathname === dest.href) {
      navPendingRef.current = null;
      if (!audioMode) setModalOpen(true);
    }
  }, [pathname, audioMode]);

  // Kiosk lockdown (demo only — this component mounts solely when the tour is
  // enabled). Block ALL user-initiated link navigation so visitors can only go
  // where the tour or the "Talk to Hope" assistant takes them — no wandering
  // off to arbitrary gene pages or the nav/footer. Buttons are untouched, so the
  // tour controls, the voice launcher, and the My RP Pathway / Clinical Trials
  // Finder quizzes and forms all stay fully usable (they're buttons, not links).
  // Tour + voice navigation use router.push (not anchor clicks), so they're
  // unaffected. Contact links (mailto:/tel:) are allowed through.
  useEffect(() => {
    if (!mounted) return;
    function block(e: MouseEvent) {
      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return;
      e.preventDefault();
      e.stopPropagation();
    }
    document.addEventListener("click", block, true);
    document.addEventListener("auxclick", block, true);
    return () => {
      document.removeEventListener("click", block, true);
      document.removeEventListener("auxclick", block, true);
    };
  }, [mounted]);

  // Scroll lock, derived purely from state so it can't chain a stale value.
  // (Capturing/restoring the "previous" overflow across two consecutive locked
  // dialogs — Welcome → stop modal — would restore "hidden" and freeze the page.)
  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = !ended && isDialog ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mounted, ended, isDialog, index]);

  // Dialog behavior: focus the primary action, trap Tab, Escape closes.
  useEffect(() => {
    if (!mounted || ended || !isDialog) return;

    primaryRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Escape only dismisses a per-page stop modal; the Welcome and Thanks
        // moments are deliberate full-screen states with explicit actions.
        if (step.kind === "page") {
          e.preventDefault();
          setModalOpen(false);
        }
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

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted, ended, isDialog, step.kind, index]);

  // NOTE: intentionally NOT gated on `mounted`. The initial state is always the
  // full-screen Welcome (index 0), which is deterministic, so it renders on the
  // server too — covering the homepage from the very first paint instead of
  // popping in after hydration (which looked like a flash of the page behind it).
  // `mounted` still gates the effects above, which only run client-side anyway.

  const nextLabel = !next
    ? "Finish tour"
    : next.kind === "finish"
      ? "Finish tour"
      : `Next stop: ${next.cta ?? next.title}`;

  // ---- Ended: a small launcher so the tour is always recoverable ----
  if (ended) {
    return (
      <button
        type="button"
        onClick={() => {
          setEnded(false);
          goTo(0);
        }}
        className="fixed bottom-4 left-4 z-[80] inline-flex min-h-[48px] items-center gap-2 rounded-full bg-forest px-5 py-3 font-bold text-white shadow-lg transition hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">▶</span> Start the guided tour
      </button>
    );
  }

  // ---- Full-screen Welcome / Thanks ----
  if (step.kind === "welcome" || step.kind === "finish") {
    const isWelcome = step.kind === "welcome";
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-forest px-6 text-cream"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-fullscreen-title"
      >
        <div ref={dialogRef} className="max-w-2xl text-center">
          <p className="font-display text-lg italic text-gold-soft">
            {isWelcome ? "A guided tour" : "You're all set"}
          </p>
          <h1
            id="tour-fullscreen-title"
            className="mt-4 font-display text-4xl font-medium tracking-tight sm:text-6xl"
          >
            {step.title}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-cream/85 sm:text-xl">
            {step.body}
          </p>

          {!isWelcome && (
            <div className="mx-auto mt-8 max-w-md rounded-lg bg-cream/10 p-6 text-left">
              <h2 className="font-display text-xl font-bold text-cream">Questions?</h2>
              <p className="mt-2 text-cream/85">We&rsquo;d love to hear from you.</p>
              <ul className="mt-3 space-y-1 text-cream/90">
                <li>
                  <a
                    href="mailto:information@rphope.org"
                    className="font-semibold underline decoration-gold underline-offset-2"
                  >
                    information@rphope.org
                  </a>
                </li>
                <li>
                  <a
                    href="tel:+19252091440"
                    className="font-semibold underline decoration-gold underline-offset-2"
                  >
                    925.209.1440
                  </a>
                </li>
              </ul>
            </div>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <button
              ref={primaryRef}
              type="button"
              onClick={() => goTo(isWelcome ? 1 : 0)}
              className="inline-flex min-h-[52px] items-center gap-2 rounded-md bg-gold px-8 py-4 text-lg font-bold text-ink shadow-lg transition hover:bg-gold-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-cream focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
            >
              {isWelcome ? "Start the tour" : "Start over"}
              <span aria-hidden="true">→</span>
            </button>
            {!isWelcome && (
              <button
                type="button"
                onClick={() => setEnded(true)}
                className="inline-flex min-h-[52px] items-center rounded-md border border-cream/50 px-6 py-4 font-semibold text-cream transition hover:bg-cream/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cream"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- Page stops ----
  return (
    <>
      {modalOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-ink/60 p-4">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-stop-title"
            aria-describedby="tour-stop-body"
            className="relative w-full max-w-lg rounded-xl bg-cream-header p-7 shadow-2xl sm:p-8"
          >
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              aria-label="Close and explore this page"
              className="absolute right-3 top-3 rounded-md p-2 text-ink/50 transition hover:bg-ink/5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            {/* Page stops are indexes 1..TOTAL-2 (welcome and finish bookend them). */}
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-forest">
              Stop {index} of {TOTAL - 2}
            </p>
            <h2
              id="tour-stop-title"
              className="mt-2 font-display text-3xl font-medium tracking-tight text-ink"
            >
              {step.title}
            </h2>
            <p
              id="tour-stop-body"
              className="mt-3 leading-relaxed text-ink/80"
            >
              {step.body}
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
              {index > 1 ? (
                <button
                  type="button"
                  onClick={() => goTo(index - 1)}
                  className="inline-flex min-h-[44px] items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-ink/60 transition hover:bg-ink/5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <span aria-hidden="true">←</span> Previous stop
                </button>
              ) : (
                <span />
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    stopAudio();
                    setAudioMode(false);
                    setModalOpen(false);
                  }}
                  className="inline-flex min-h-[48px] items-center gap-2 rounded-md border border-forest/40 bg-transparent px-5 py-3 font-bold text-forest transition hover:bg-forest/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
                >
                  I prefer to read
                </button>
                {ttsOk && (
                  <button
                    ref={primaryRef}
                    type="button"
                    onClick={() => {
                      // Start narration inside the click so autoplay is allowed.
                      setAudioMode(true);
                      setModalOpen(false);
                      speakStop(step);
                    }}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-md bg-forest px-5 py-3 font-bold text-white transition hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
                  >
                    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 5 6 9H3v6h3l5 4V5z" />
                      <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
                    </svg>
                    Audio Tour
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audio-tour caption — shows the narration text while it's being read and
          disappears once the voice finishes. Includes the required stop control
          (WCAG 1.4.2) and a way to switch to reading. Centered and width-capped
          so it stays clear of the bottom-right Next / mic controls. */}
      {speaking && !modalOpen && !isDialog && (
        <div
          role="group"
          aria-label="Audio tour narration"
          className="fixed bottom-6 left-1/2 z-[80] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-ink/15 bg-cream-header p-4 shadow-2xl"
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-forest">
            <span className="flex gap-0.5" aria-hidden="true">
              <span className="h-3 w-1 animate-pulse rounded-full bg-forest" />
              <span className="h-3 w-1 animate-pulse rounded-full bg-forest [animation-delay:150ms]" />
              <span className="h-3 w-1 animate-pulse rounded-full bg-forest [animation-delay:300ms]" />
            </span>
            Audio tour
          </div>
          <p className="mt-2 max-h-40 overflow-y-auto leading-relaxed text-ink/85">
            <span className="font-semibold text-ink">{step.title}.</span> {step.body}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={stopAudio}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-bold text-cream transition hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
            >
              <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="1.5" />
              </svg>
              Stop audio
            </button>
            <button
              type="button"
              onClick={() => {
                stopAudio();
                setAudioMode(false);
                setModalOpen(true);
              }}
              className="inline-flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm font-semibold text-ink/60 transition hover:bg-ink/5 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              Switch to reading
            </button>
          </div>
        </div>
      )}

      {/* Always-available "Next stop" — docked bottom-right, stacked ABOVE the
          "Talk to Hope" mic launcher (which owns bottom-4 right-4) so they
          never overlap. Hidden only while the stop modal covers the screen. */}
      {!modalOpen && (
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          className="fixed bottom-24 right-4 z-[80] inline-flex min-h-[52px] max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full bg-forest px-6 py-3.5 font-bold text-white shadow-2xl transition hover:bg-forest-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
        >
          <span className="truncate">{nextLabel}</span>
          <span aria-hidden="true">→</span>
        </button>
      )}
    </>
  );
}
