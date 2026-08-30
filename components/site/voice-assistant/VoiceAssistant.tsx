"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRPVoiceAssistant } from "@/hooks/useRPVoiceAssistant";
import {
  applyPreferences,
  getPreferences,
} from "@/lib/voice/accessibilityPreferences";
import VoiceAssistantPanel from "./VoiceAssistantPanel";

// Persistent "Talk to Hope" launcher + the conversational panel. Mounted once
// globally in the layout. The microphone is never activated automatically — a
// session only starts on an explicit user action inside the panel.
export default function VoiceAssistant() {
  const voice = useRPVoiceAssistant();
  const [open, setOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement | null>(null);

  // Apply any saved accessibility preferences on first load.
  useEffect(() => {
    applyPreferences(getPreferences());
  }, []);

  // Closing the panel must also END the conversation. Previously this only hid
  // the UI, leaving the Realtime session connected and the microphone live with
  // no visible indication — the X looked like it hung up but did not.
  // "Talk to Hope" IS the start control — opening the panel and starting the
  // session are one explicit user action. (The microphone is still never
  // activated automatically: this click is the explicit action.)
  const openAndStart = useCallback(() => {
    setOpen(true);
    void voice.start();
  }, [voice]);

  // When a conversation ends normally, close the panel so the launcher is the
  // single way back in. An error or an expired session keeps the panel open, so
  // the message and "Try again" stay visible.
  const wasConnected = useRef(false);
  useEffect(() => {
    if (voice.status === "connected") {
      wasConnected.current = true;
      return;
    }
    if (
      wasConnected.current &&
      voice.status === "idle" &&
      !voice.error &&
      !voice.sessionExpired
    ) {
      wasConnected.current = false;
      setOpen(false);
      window.setTimeout(() => launcherRef.current?.focus(), 0);
    }
  }, [voice.status, voice.error, voice.sessionExpired]);

  const close = useCallback(() => {
    voice.end();
    setOpen(false);
    // Restore focus to the launcher when the panel closes.
    window.setTimeout(() => launcherRef.current?.focus(), 0);
  }, [voice]);

  // End the live conversation when the guided tour advances to another stop —
  // a visitor moving on shouldn't carry an open mic session into the next stop.
  useEffect(() => {
    function onTourAdvance() {
      voice.end();
      setOpen(false);
    }
    window.addEventListener("rphope:tour-advance", onTourAdvance);
    return () => window.removeEventListener("rphope:tour-advance", onTourAdvance);
  }, [voice]);

  // Escape: interrupt speech if speaking, otherwise close the panel.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (voice.activity === "speaking") {
        voice.stopSpeaking();
      } else {
        close();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, voice, close]);

  return (
    <>
      {/* Global polite live region for connection/navigation announcements. */}
      <div aria-live="polite" className="sr-only" data-voice-assistant>
        {voice.announcement}
      </div>

      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={openAndStart}
          aria-haspopup="dialog"
          className="fixed bottom-4 right-4 z-50 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-maroon-brand px-5 py-3 font-bold text-white shadow-lg transition hover:bg-maroon-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2"
          data-voice-assistant
        >
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
          Talk to Hope
        </button>
      )}

      {open && <VoiceAssistantPanel voice={voice} onClose={close} />}
    </>
  );
}
