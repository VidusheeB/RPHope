"use client";

import { useEffect, useState } from "react";
import { speak, cancelSpeech, isSpeechSupported } from "@/lib/speech";

/**
 * "Listen to this page" — a secondary read-aloud aid for users who do NOT run a
 * screen reader (mild low vision, dyslexia/cognitive needs, aging users). Per
 * CLAUDE.md, flawless semantic HTML is the primary read-aloud experience; this
 * is an optional add-on.
 *
 * Rules honored here:
 * - Browser-native Web Speech API (SpeechSynthesis). Free, client-side, no keys.
 * - Never autoplays (WCAG 1.4.2): speech starts only on user action.
 * - Keyboard-operable with an accessible name and visible pause/stop.
 * - `aria-hidden` so it does not duplicate content for an active screen reader.
 *
 * Pass the exact `text` to read (verbatim published content) so we never speak
 * an AI paraphrase or unrelated chrome.
 */
export default function ListenButton({ text }: { text: string }) {
  // "idle" | "playing" | "paused". `supported` is null until we check on mount
  // (SpeechSynthesis is a browser API and absent during SSR).
  const [supported, setSupported] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "playing" | "paused">("idle");

  useEffect(() => {
    setSupported(isSpeechSupported());
    // Stop any speech if the user navigates away.
    return () => cancelSpeech();
  }, []);

  function play() {
    speak(text, { onEnd: () => setState("idle") });
    setState("playing");
  }

  function pause() {
    window.speechSynthesis.pause();
    setState("paused");
  }

  function resume() {
    window.speechSynthesis.resume();
    setState("playing");
  }

  function stop() {
    window.speechSynthesis.cancel();
    setState("idle");
  }

  // Hide entirely until we know it is supported (avoids a dead button on
  // unsupported browsers and avoids an SSR/client mismatch).
  if (supported === null) return null;
  if (!supported) return null;

  const buttonBase =
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

  return (
    <div
      // Decorative for screen-reader users, who have their own read-aloud.
      aria-hidden="true"
      className="flex flex-wrap items-center gap-2"
    >
      {state === "idle" && (
        <button type="button" onClick={play} className={`${buttonBase} bg-forest text-white hover:bg-forest/90`}>
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
