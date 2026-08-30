// Microphone and playback lifecycle for the Realtime voice session, kept out of
// the React hook so the privacy-critical behaviour is directly testable.
//
// The distinction these functions encode:
//   MUTE  = disable the mic track. The session stays connected, Hope's output
//           audio is untouched, and the track can be re-enabled instantly.
//   END   = stop the mic track and release everything. Not reversible.
//
// Muting only prevents FUTURE microphone audio from being sent. It makes no
// claim about audio already captured or processed.

/** The parts of a RealtimeSession these helpers use. Narrow on purpose. */
export type SessionLike = {
  mute?: (muted: boolean) => void;
  interrupt?: () => void;
  close?: () => void;
};

export type MediaRefs = {
  session: SessionLike | null;
  stream: MediaStream | null;
  audioEl: HTMLAudioElement | null;
};

/**
 * Enable or disable microphone INPUT without touching the connection.
 *
 * Belt and braces on purpose: `session.mute()` is the SDK abstraction (it sets
 * `enabled` on each RTCRtpSender's track), and we set `enabled` on the stream
 * we own as well, so the state is still correct if the session is mid-teardown
 * or the transport didn't support muting.
 */
export function setMicrophoneEnabled(refs: MediaRefs, enabled: boolean): void {
  try {
    refs.session?.mute?.(!enabled);
  } catch {
    /* transport may not support muting */
  }
  for (const track of refs.stream?.getAudioTracks() ?? []) {
    try {
      track.enabled = enabled;
    } catch {
      /* ignore */
    }
  }
}

/** True when the live microphone track is actually capturing. Used so the UI
 *  can reflect the real state rather than an assumed one. */
export function isMicrophoneLive(refs: MediaRefs): boolean {
  const tracks = refs.stream?.getAudioTracks() ?? [];
  return tracks.length > 0 && tracks.some((t) => t.enabled && t.readyState !== "ended");
}

/**
 * Full teardown: cancel any in-flight response, close the data channel and peer
 * connection, STOP every local track, and silence playback.
 *
 * `session.close()` stops the tracks attached to senders, but we also stop the
 * stream we opened — that is what guarantees the browser's microphone indicator
 * goes out even if `connect()` never completed — and the SDK never pauses the
 * audio element, so we do that too.
 */
export function releaseMedia(refs: MediaRefs, opts?: { interrupt?: boolean }): void {
  // interrupt() sends output_audio_buffer.clear, which TRUNCATES whatever is
  // playing. Skip it when a spoken goodbye has already finished on its own —
  // otherwise the last word is cut off.
  if (opts?.interrupt !== false) {
    try {
      refs.session?.interrupt?.();
    } catch {
      /* not connected */
    }
  }
  try {
    refs.session?.close?.();
  } catch {
    /* ignore */
  }
  for (const track of refs.stream?.getTracks() ?? []) {
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  }
  if (refs.audioEl) {
    try {
      refs.audioEl.pause();
      refs.audioEl.srcObject = null;
    } catch {
      /* ignore */
    }
  }
}
