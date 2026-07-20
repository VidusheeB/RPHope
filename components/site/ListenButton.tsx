"use client";

import { useEffect, useState } from "react";
import {
  speak,
  cancelSpeech,
  pauseSpeech,
  resumeSpeech,
  isTTSAvailable,
  prefetchSpeech,
  cancelPrefetch,
} from "@/lib/speech";

/**
 * "Listen to this page" — a secondary read-aloud aid for users who do NOT run a
 * screen reader (mild low vision, dyslexia/cognitive needs, aging users). Per
 * CLAUDE.md, flawless semantic HTML is the primary read-aloud experience; this
 * is an optional add-on.
 *
 * Rules honored here:
 * - Never autoplays (WCAG 1.4.2): speech starts only on user action.
 * - Keyboard-operable with an accessible name and visible pause/stop.
 * - `aria-hidden` so it does not duplicate content for an active screen reader.
 *
 * Voice is OpenAI TTS (`/api/tts`) — the button checks that it's actually
 * configured server-side (isTTSAvailable) rather than any browser speech
 * feature, since playback here is just an <audio> element.
 *
 * Pass the exact `text` to read (verbatim published content) so we never speak
 * an AI paraphrase or unrelated chrome.
 */
export default function ListenButton({ text }: { text: string }) {
  // "idle" | "playing" | "paused" | "error". `available` is null until the
  // server-side TTS check resolves (async — a browser API is absent during SSR).
  const [available, setAvailable] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "playing" | "paused" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    isTTSAvailable().then((ok) => {
      if (!cancelled) setAvailable(ok);
    });
    return () => {
      cancelled = true;
      cancelSpeech();
      cancelPrefetch();
    };
  }, []);

  // Start generating the first bit of audio as soon as intent looks likely
  // (hover/keyboard focus), so a real click is often instant. Never plays
  // anything — WCAG 1.4.2 still holds; only the click below does that.
  function warm() {
    prefetchSpeech(text);
  }

  function play() {
    setState("playing");
    speak(text, {
      onEnd: () => setState("idle"),
      onError: () => setState("error"),
    });
  }

  function pause() {
    // Use the module's pause so it can resume without restarting the request.
    pauseSpeech();
    setState("paused");
  }

  function resume() {
    resumeSpeech();
    setState("playing");
  }

  function stop() {
    // Use the module's cancel so it bumps the generation token and drops any
    // in-flight request (a raw pause only stops the current chunk).
    cancelSpeech();
    setState("idle");
  }

  // Hide entirely until we know OpenAI TTS is configured (avoids a dead button
  // when it isn't, and avoids an SSR/client mismatch).
  if (available === null) return null;
  if (!available) return null;

  const buttonBase =
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

  return (
    <div
      // Decorative for screen-reader users, who have their own read-aloud.
      aria-hidden="true"
      className="flex flex-wrap items-center gap-2"
    >
      {state === "idle" && (
        <button
          type="button"
          onClick={play}
          onMouseEnter={warm}
          onFocus={warm}
          className={`${buttonBase} bg-forest text-white hover:bg-forest/90`}
        >
          <SpeakerIcon />
          Listen to this page
        </button>
      )}

      {state === "playing" && (
        <>
          <button type="button" onClick={pause} className={`${buttonBase} bg-forest text-white hover:bg-forest/90`}>
            <PauseIcon />
            Pause
          </button>
          <button type="button" onClick={stop} className={`${buttonBase} border border-forest/30 bg-white text-forest hover:bg-forest/5`}>
            Stop
          </button>
        </>
      )}

      {state === "paused" && (
        <>
          <button type="button" onClick={resume} className={`${buttonBase} bg-forest text-white hover:bg-forest/90`}>
            <SpeakerIcon />
            Resume
          </button>
          <button type="button" onClick={stop} className={`${buttonBase} border border-forest/30 bg-white text-forest hover:bg-forest/5`}>
            Stop
          </button>
        </>
      )}

      {state === "error" && (
        <>
          <span className="text-sm text-maroon">Couldn&rsquo;t play audio.</span>
          <button type="button" onClick={play} className={`${buttonBase} bg-forest text-white hover:bg-forest/90`}>
            <SpeakerIcon />
            Try again
          </button>
        </>
      )}
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}
