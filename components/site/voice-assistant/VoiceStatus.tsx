"use client";

import type { Activity, ConnectionStatus } from "@/hooks/useRPVoiceAssistant";

// Conveys state with TEXT + ICON + shape, never color alone (WCAG 1.4.1).
const LABELS: Record<string, { label: string; dot: string }> = {
  connecting: { label: "Connecting…", dot: "animate-pulse bg-gold" },
  listening: { label: "Listening", dot: "bg-forest" },
  thinking: { label: "Thinking…", dot: "animate-pulse bg-gold" },
  speaking: { label: "Speaking", dot: "bg-forest" },
  muted: { label: "Microphone muted", dot: "bg-ink/40" },
  error: { label: "Something went wrong", dot: "bg-red-600" },
  idle: { label: "Ready", dot: "bg-ink/30" },
};

export default function VoiceStatus({
  status,
  activity,
  muted,
}: {
  status: ConnectionStatus;
  activity: Activity;
  muted: boolean;
}) {
  const key =
    status === "connecting"
      ? "connecting"
      : status === "error"
      ? "error"
      : status !== "connected"
      ? "idle"
      : muted
      ? "muted"
      : activity;
  const state = LABELS[key] ?? LABELS.idle;

  return (
    <p
      className="flex items-center gap-2 text-sm font-semibold text-ink"
      aria-live="polite"
    >
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${state.dot}`} />
      {state.label}
    </p>
  );
}
