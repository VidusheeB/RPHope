// The voice assistant's status vocabulary, kept out of the component so the
// state table is testable and so the same wording is used for both the visible
// label and the ARIA live announcement.
//
// State is conveyed by TEXT (plus an icon/shape), never colour alone — WCAG
// 1.4.1. The dot is decorative.

import type { Activity, ConnectionStatus } from "@/hooks/useRPVoiceAssistant";

export const VOICE_STATUS_LABELS: Record<string, { label: string; dot: string }> = {
  connecting: { label: "Connecting…", dot: "animate-pulse bg-gold" },
  listening: { label: "Listening", dot: "bg-forest" },
  thinking: { label: "Thinking…", dot: "animate-pulse bg-gold" },
  speaking: { label: "Hope is speaking", dot: "bg-forest" },
  // Names the consequence, not just the control state — "muted" alone doesn't
  // tell a non-technical user whether they still have an open microphone.
  muted: { label: "Muted — Hope cannot hear you", dot: "bg-ink/40" },
  ending: { label: "Ending…", dot: "animate-pulse bg-ink/40" },
  ended: { label: "Conversation ended", dot: "bg-ink/30" },
  error: { label: "Something went wrong", dot: "bg-red-600" },
  idle: { label: "Ready", dot: "bg-ink/30" },
};

/** Which status applies, given connection + activity + real microphone state. */
export function voiceStatusKey(
  status: ConnectionStatus,
  activity: Activity,
  muted: boolean
): string {
  if (status === "connecting") return "connecting";
  if (status === "ending") return "ending";
  if (status === "error") return "error";
  if (status !== "connected") return "idle";
  // Mute outranks activity: the status must reflect the microphone's ACTUAL
  // state, never an assumed one.
  return muted ? "muted" : activity;
}

/** The visible/announced text for a status key. */
export function voiceStatusLabel(key: string): string {
  return (VOICE_STATUS_LABELS[key] ?? VOICE_STATUS_LABELS.idle).label;
}
