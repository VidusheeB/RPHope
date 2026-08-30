// Sequencing for the spoken goodbye, extracted so it can be unit-tested with a
// fake emitter and fake timers. This shipped broken once: Hope was cut off
// mid-word.
//
// Two things went wrong, and both are guarded against here.
//
//  1. The old code waited for a single `audio_stopped`. But the user says
//     "goodbye", the model calls end_voice_session, and THAT turn emits its own
//     audio_stopped BEFORE the goodbye line has begun — so teardown fired
//     immediately. We therefore wait for the goodbye audio to actually START
//     and only then treat a stop as the end of it.
//  2. Teardown called session.interrupt(), which sends output_audio_buffer.clear
//     and actively truncates whatever is playing. When the goodbye has finished
//     on its own there is nothing to interrupt, so we close WITHOUT it.
//
// After the audio stops we wait a short tail before closing, so the connection
// doesn't drop on the final syllable.

/** Minimal shape of the RealtimeSession events used here. */
export type GoodbyeEmitter = {
  on: (event: string, listener: () => void) => unknown;
  off?: (event: string, listener: () => void) => unknown;
};

export type GoodbyeTimers = {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (handle: ReturnType<typeof setTimeout>) => void;
};

/** Let the last syllable land before closing the connection. */
export const GOODBYE_TAIL_MS = 1000;
/** Hard stop. This is the PRIMARY path, not an emergency one: the goodbye is a
 *  fixed short line, so we simply give it this long and then close. Waiting on
 *  audio events alone proved unreliable in the browser — the panel froze on
 *  "Ending…" — so nothing here depends on an event arriving. */
export const GOODBYE_TIMEOUT_MS = 3500;

export type GoodbyeOptions = {
  session: GoodbyeEmitter;
  /** True when Hope is ALREADY speaking as the teardown begins. The model can
   *  emit the goodbye audio and call end_voice_session in the same turn, in
   *  which case `audio_start` fires before we attach and would never be seen —
   *  leaving the panel stuck on "Ending…" until the hard timeout. */
  alreadySpeaking?: boolean;
  /** Called exactly once. `interrupt` is false when the goodbye finished on its
   *  own (nothing to cancel) and true when we gave up waiting. */
  onSettled: (opts: { interrupt: boolean }) => void;
  timers?: GoodbyeTimers;
  tailMs?: number;
  timeoutMs?: number;
};

/**
 * Wait for the goodbye line to finish, then settle. Returns a `cancel` that
 * detaches listeners and timers (used if teardown is forced from elsewhere).
 */
export function awaitGoodbye({
  session,
  onSettled,
  alreadySpeaking = false,
  timers = { setTimeout, clearTimeout },
  tailMs = GOODBYE_TAIL_MS,
  timeoutMs = GOODBYE_TIMEOUT_MS,
}: GoodbyeOptions): () => void {
  let audioStarted = alreadySpeaking;
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      timers.clearTimeout(timer);
      timer = null;
    }
  };

  const detach = () => {
    clearTimer();
    try {
      session.off?.("audio_start", onStart);
      session.off?.("audio_stopped", onStopped);
    } catch {
      /* emitter may not support off() */
    }
  };

  const settle = (interrupt: boolean) => {
    if (settled) return; // exactly once
    settled = true;
    detach();
    onSettled({ interrupt });
  };

  function onStart() {
    audioStarted = true;
  }

  function onStopped() {
    // Ignore a stop belonging to the turn that CALLED the tool — the goodbye
    // itself hasn't been spoken yet.
    if (!audioStarted || settled) return;
    // Finish EARLY if the audio genuinely ended before the deadline; otherwise
    // the deadline below closes it regardless. Never extends past the deadline.
    clearTimer();
    timer = timers.setTimeout(() => settle(false), tailMs);
  }

  session.on("audio_start", onStart);
  session.on("audio_stopped", onStopped);
  timer = timers.setTimeout(() => settle(true), timeoutMs);

  return () => settle(true);
}
