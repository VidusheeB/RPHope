"use client";

import { useEffect, useRef, useState } from "react";
import type { useRPVoiceAssistant } from "@/hooks/useRPVoiceAssistant";
import VoiceStatus from "./VoiceStatus";
import VoiceControls from "./VoiceControls";
import VoiceTranscript from "./VoiceTranscript";
import VoiceSources from "./VoiceSources";
import {
  getPreferences,
  setPreferences,
  type AccessibilityPreferences,
} from "@/lib/voice/accessibilityPreferences";

type Voice = ReturnType<typeof useRPVoiceAssistant>;

const pill =
  "min-h-[36px] rounded-md border px-3 py-1.5 text-xs font-semibold transition";

export default function VoiceAssistantPanel({
  voice,
  onClose,
}: {
  voice: Voice;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [prefs, setPrefs] = useState<AccessibilityPreferences>(getPreferences);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function updatePref(update: Partial<AccessibilityPreferences>) {
    setPrefs(setPreferences(update));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    voice.sendText(t);
    setText("");
  }

  const connected = voice.status === "connected";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-panel-title"
      data-voice-assistant
      className="fixed bottom-24 right-4 z-[60] flex max-h-[80vh] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-ink/15 bg-cream-header shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-ink/12 bg-white px-4 py-3">
        <div>
          <h2
            id="voice-panel-title"
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-lg font-medium tracking-tight text-ink outline-none"
          >
            Talk to RP Hope
          </h2>
          <VoiceStatus status={voice.status} activity={voice.activity} muted={voice.muted} />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close voice assistant"
          className="grid min-h-[44px] min-w-[44px] place-items-center rounded-md text-ink/70 hover:bg-ink/5 hover:text-ink"
        >
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {voice.status === "unconfigured" ? (
          <div className="rounded-md border border-gold/40 bg-butter/50 p-4 text-sm leading-relaxed text-ink/80">
            <p className="font-semibold text-ink">Voice assistant is not configured yet.</p>
            <p className="mt-1">
              A site administrator needs to add an OpenAI API key. Once it&rsquo;s set,
              you&rsquo;ll be able to have a spoken conversation here. In the meantime,
              you can browse the site normally.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {voice.error && (
              <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                {voice.error}
              </p>
            )}

            {voice.sessionExpired && (
              <p className="rounded-md border border-gold/40 bg-butter/50 p-3 text-sm text-ink/80">
                This session reached its 45-minute limit. Start a new conversation to keep going.
              </p>
            )}

            <VoiceControls
              status={voice.status}
              muted={voice.muted}
              onStart={voice.start}
              onEnd={voice.end}
              onToggleMute={voice.toggleMute}
              onStopSpeaking={voice.stopSpeaking}
            />

            <VoiceTranscript transcript={voice.transcript} captions={prefs.captions} />

            <VoiceSources sources={voice.sources} />

            {/* Text input — a complete alternative to voice. */}
            <form onSubmit={submit} className="flex gap-2">
              <label htmlFor="voice-text-input" className="sr-only">
                Type your question
              </label>
              <input
                id="voice-text-input"
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={connected ? "Type a question…" : "Start a conversation, or type here after"}
                disabled={!connected}
                className="min-h-[44px] w-full rounded-md border border-ink/25 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-forest disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!connected || !text.trim()}
                className="min-h-[44px] rounded-md bg-forest px-4 text-sm font-bold text-white hover:bg-forest-dark disabled:opacity-50"
              >
                Send
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={voice.clearTranscript}
                className="min-h-[36px] text-xs font-semibold text-ink/60 underline hover:text-ink"
              >
                Clear transcript
              </button>
            </div>

            {/* Accessibility preferences */}
            <details className="rounded-md border border-ink/12 bg-white">
              <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-ink">
                Accessibility preferences
              </summary>
              <div className="flex flex-col gap-3 border-t border-ink/10 px-3 py-3">
                <fieldset>
                  <legend className="text-xs font-bold uppercase tracking-wide text-ink/60">Text size</legend>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {(["default", "large", "extra-large"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={prefs.textScale === v}
                        onClick={() => updatePref({ textScale: v })}
                        className={`${pill} ${prefs.textScale === v ? "border-forest bg-forest text-white" : "border-ink/25 text-ink"}`}
                      >
                        {v === "extra-large" ? "Extra large" : v[0].toUpperCase() + v.slice(1)}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-pressed={prefs.contrast === "high"}
                    onClick={() => updatePref({ contrast: prefs.contrast === "high" ? "default" : "high" })}
                    className={`${pill} ${prefs.contrast === "high" ? "border-forest bg-forest text-white" : "border-ink/25 text-ink"}`}
                  >
                    High contrast
                  </button>
                  <button
                    type="button"
                    aria-pressed={prefs.captions}
                    onClick={() => updatePref({ captions: !prefs.captions })}
                    className={`${pill} ${prefs.captions ? "border-forest bg-forest text-white" : "border-ink/25 text-ink"}`}
                  >
                    Captions
                  </button>
                  <button
                    type="button"
                    aria-pressed={prefs.reducedMotion}
                    onClick={() => updatePref({ reducedMotion: !prefs.reducedMotion })}
                    className={`${pill} ${prefs.reducedMotion ? "border-forest bg-forest text-white" : "border-ink/25 text-ink"}`}
                  >
                    Reduce motion
                  </button>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Persistent honesty notice */}
      <p className="border-t border-ink/12 bg-white px-4 py-2 text-xs leading-relaxed text-ink/60">
        The RP Hope Guide can make mistakes and is not a medical professional. For medical
        decisions, talk with a clinician or genetic counselor.
      </p>
    </div>
  );
}
