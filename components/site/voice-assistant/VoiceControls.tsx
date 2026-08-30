"use client";

import type { ConnectionStatus } from "@/hooks/useRPVoiceAssistant";

// All controls are >=44px targets, keyboard-operable, with text labels (not
// icon-only) and visible focus rings from globals.css.
const btn =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold transition";

export default function VoiceControls({
  status,
  muted,
  onStart,
  onEnd,
  onToggleMute,
  onStopSpeaking,
}: {
  status: ConnectionStatus;
  muted: boolean;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onStopSpeaking: () => void;
}) {
  const connected = status === "connected";
  const connecting = status === "connecting";
  const ending = status === "ending";

  // There is deliberately NO "Start conversation" button: the "Talk to Hope"
  // launcher starts the session itself, so opening the panel and starting are
  // one action. While connecting or ending, the status line carries the state
  // and no control is offered. The only case that still needs a button is a
  // failed or expired session — without it the panel would be a dead end.
  if (!connected) {
    if (connecting || ending || status === "unconfigured") return null;
    return (
      <button
        type="button"
        onClick={onStart}
        className={`${btn} w-full bg-forest text-white hover:bg-forest-dark`}
      >
        <MicIcon />
        Try again
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onToggleMute}
        aria-pressed={muted}
        disabled={ending}
        className={`${btn} border disabled:opacity-60 ${
          muted
            ? "border-ink/30 bg-ink/5 text-ink"
            : "border-forest/40 bg-forest/5 text-forest"
        }`}
      >
        {muted ? <MicOffIcon /> : <MicIcon />}
        {muted ? "Unmute" : "Mute"}
      </button>
      <button
        type="button"
        onClick={onStopSpeaking}
        disabled={ending}
        className={`${btn} border border-forest/40 bg-white text-forest hover:bg-forest/5 disabled:opacity-60`}
      >
        <StopIcon />
        Stop speaking
      </button>
      <button
        type="button"
        onClick={onEnd}
        disabled={ending}
        className={`${btn} ml-auto bg-ink text-white hover:bg-black disabled:opacity-60`}
      >
        {ending ? "Ending…" : "End"}
      </button>
    </div>
  );
}

function MicIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
function MicOffIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 9v-3a3 3 0 0 1 5.1-2.1M15 11.5V5M5 11a7 7 0 0 0 10.5 6M19 11a7 7 0 0 1-.6 2.8M12 18v3M3 3l18 18" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
