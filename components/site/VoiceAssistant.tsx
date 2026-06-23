"use client";

import { useVoiceAgent, type AgentStatus } from "@/lib/useVoiceAgent";

/**
 * Hands-free voice navigation assistant (CLAUDE.md's voice-navigation idea).
 *
 * Flow: one tap on "Click to use mic" grants mic permission AND satisfies the
 * browser's one-time user-gesture requirement (which also unlocks audio). After
 * that it speaks an intro, then listens continuously for the wake phrase
 * "Hello Claude" and maps the following request to a real page — confirming
 * before it navigates. Fully hands-free after the single enabling tap, because
 * a visitor who can't see the screen can't find a button.
 *
 * Opt-in and OFF by default so it never fights an active screen reader
 * (VoiceOver/NVDA/JAWS) — it targets the low-vision / aging audience that does
 * NOT run one, per CLAUDE.md.
 */
export default function VoiceAssistant() {
  const { status, heard, message, enable, disable, pause, resume, stop } =
    useVoiceAgent();

  if (status === "unsupported") return null; // typed assistant remains available

  const active = status !== "off";

  return (
    <div className="fixed bottom-4 right-4 z-50 print:hidden">
      {!active ? (
        <button
          type="button"
          onClick={enable}
          className="flex items-center gap-2 rounded-full bg-forest px-5 py-3 font-bold text-white shadow-lg transition hover:bg-forest/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-forest"
        >
          <MicIcon />
          Click to use mic
        </button>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="w-72 max-w-[85vw] rounded-2xl border border-forest/20 bg-white p-4 shadow-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-bold text-forest">
              <StatusDot status={status} />
              {statusLabel(status)}
            </span>
            <button
              type="button"
              onClick={disable}
              className="rounded-full px-2 py-1 text-xs font-bold text-ink/60 underline hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
            >
              Turn off
            </button>
          </div>

          {heard && (
            <p className="mt-3 text-sm text-ink/70">
              <span className="font-semibold text-ink/50">You said:</span> {heard}
            </p>
          )}
          {message && (
            <p className="mt-2 max-h-32 overflow-y-auto text-sm text-ink/90">
              <span className="font-semibold text-ink/50">Claude:</span> {message}
            </p>
          )}

          {/* Reliable, keyboard-operable playback controls (WCAG: a spoken
              answer must offer visible pause/stop). Shown while Claude speaks or
              is paused; the spoken "stop"/"pause"/"continue" words do the same. */}
          {(status === "speaking" || status === "paused") && (
            <div className="mt-3 flex gap-2">
              {status === "speaking" ? (
                <button
                  type="button"
                  onClick={pause}
                  className="flex-1 rounded-lg border border-forest/30 bg-forest/5 px-3 py-2 text-sm font-bold text-forest hover:bg-forest/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
                >
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resume}
                  className="flex-1 rounded-lg border border-forest/30 bg-forest/5 px-3 py-2 text-sm font-bold text-forest hover:bg-forest/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest"
                >
                  Continue
                </button>
              )}
              <button
                type="button"
                onClick={stop}
                className="flex-1 rounded-lg bg-forest px-3 py-2 text-sm font-bold text-white hover:bg-forest/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-1"
              >
                Stop
              </button>
            </div>
          )}

          <p className="mt-3 text-xs text-ink/50">
            Start every request with my name — e.g. “Claude, take me to the
            stories page,” or “Claude, pause.” AI assistant grounded in this site
            — not medical advice.
          </p>
        </div>
      )}
    </div>
  );
}

function statusLabel(s: AgentStatus): string {
  switch (s) {
    case "idle":
      return "Say “Claude, …”";
    case "listening":
      return "Say “Claude, …”";
    case "thinking":
      return "Finding it…";
    case "confirming":
      return "Say yes or no";
    case "speaking":
      return "Speaking…";
    case "paused":
      return "Paused — say “Claude, continue”";
    default:
      return "Voice on";
  }
}

function StatusDot({ status }: { status: AgentStatus }) {
  // Shape + animation, not color alone (a11y): pulses while actively engaged.
  const engaged = status === "listening" || status === "confirming";
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2.5 w-2.5 rounded-full bg-forest ${
        engaged ? "motion-safe:animate-pulse" : ""
      }`}
    />
  );
}

function MicIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}
