"use client";

import type { Activity, ConnectionStatus } from "@/hooks/useRPVoiceAssistant";
import {
  VOICE_STATUS_LABELS,
  voiceStatusKey,
} from "@/lib/voice/statusLabels";

// Conveys state with TEXT + ICON + shape, never color alone (WCAG 1.4.1).
// The wording lives in lib/voice/statusLabels.ts so it stays identical between
// the visible label and the announcement.
export default function VoiceStatus({
  status,
  activity,
  muted,
}: {
  status: ConnectionStatus;
  activity: Activity;
  muted: boolean;
}) {
  const key = voiceStatusKey(status, activity, muted);
  const state = VOICE_STATUS_LABELS[key] ?? VOICE_STATUS_LABELS.idle;

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
