// Regression tests for the goodbye being cut off mid-word.

import { describe, it, expect, vi } from "vitest";
import { awaitGoodbye, GOODBYE_TAIL_MS, GOODBYE_TIMEOUT_MS } from "@/lib/voice/goodbye";

/** A fake RealtimeSession emitter plus controllable timers. */
function harness() {
  const listeners: Record<string, (() => void)[]> = {};
  const session = {
    on: (e: string, l: () => void) => ((listeners[e] ??= []).push(l), undefined),
    off: (e: string, l: () => void) => {
      listeners[e] = (listeners[e] ?? []).filter((x) => x !== l);
      return undefined;
    },
  };
  const emit = (e: string) => [...(listeners[e] ?? [])].forEach((l) => l());

  let now = 0;
  const pending: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  const timers = {
    setTimeout: ((fn: () => void, ms: number) => {
      const id = nextId++;
      pending.push({ at: now + ms, fn, id });
      return id as unknown as ReturnType<typeof setTimeout>;
    }) as typeof globalThis.setTimeout,
    clearTimeout: ((h: unknown) => {
      const i = pending.findIndex((p) => p.id === (h as number));
      if (i >= 0) pending.splice(i, 1);
    }) as typeof globalThis.clearTimeout,
  };
  const advance = (ms: number) => {
    now += ms;
    for (const p of pending.filter((p) => p.at <= now)) {
      pending.splice(pending.indexOf(p), 1);
      p.fn();
    }
  };
  return { session, emit, timers, advance, listenerCount: () => Object.values(listeners).flat().length };
}

describe("the goodbye is allowed to finish", () => {
  it("does NOT close on the audio_stopped of the turn that called the tool", () => {
    // The exact bug: the user says "goodbye", the model calls end_voice_session,
    // and that turn emits audio_stopped BEFORE the goodbye line is spoken.
    const h = harness();
    const onSettled = vi.fn();
    awaitGoodbye({ session: h.session, onSettled, timers: h.timers });

    h.emit("audio_stopped"); // tool-call turn ending — must be ignored
    h.advance(GOODBYE_TAIL_MS + 50);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it("closes a beat after the goodbye audio actually finishes", () => {
    const h = harness();
    const onSettled = vi.fn();
    awaitGoodbye({ session: h.session, onSettled, timers: h.timers });

    h.emit("audio_start");
    h.emit("audio_stopped");
    expect(onSettled).not.toHaveBeenCalled(); // not instantly — that clips it

    h.advance(GOODBYE_TAIL_MS);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("closes WITHOUT interrupting when the goodbye finished on its own", () => {
    // interrupt() sends output_audio_buffer.clear and would truncate the word.
    const h = harness();
    const onSettled = vi.fn();
    awaitGoodbye({ session: h.session, onSettled, timers: h.timers });

    h.emit("audio_start");
    h.emit("audio_stopped");
    h.advance(GOODBYE_TAIL_MS);
    expect(onSettled).toHaveBeenCalledWith({ interrupt: false });
  });

  it("waits a full second by default", () => {
    expect(GOODBYE_TAIL_MS).toBe(1000);
  });
});

describe("but never hangs", () => {
  it("closes anyway if the goodbye audio never arrives", () => {
    const h = harness();
    const onSettled = vi.fn();
    awaitGoodbye({ session: h.session, onSettled, timers: h.timers });

    h.advance(GOODBYE_TIMEOUT_MS);
    expect(onSettled).toHaveBeenCalledWith({ interrupt: true });
  });

  it("closes if audio starts but never stops", () => {
    const h = harness();
    const onSettled = vi.fn();
    awaitGoodbye({ session: h.session, onSettled, timers: h.timers });

    h.emit("audio_start");
    h.advance(GOODBYE_TIMEOUT_MS);
    expect(onSettled).toHaveBeenCalledWith({ interrupt: true });
  });

  it("balances room for the spoken line against a panel that looks hung", () => {
    // Long enough to cover the tool call plus a short spoken line, short
    // enough that a missed audio event never leaves "Ending…" on screen for
    // an uncomfortable stretch.
    expect(GOODBYE_TIMEOUT_MS).toBeGreaterThanOrEqual(2500);
    expect(GOODBYE_TIMEOUT_MS).toBeLessThanOrEqual(4000);
  });

  it("cancels the hard timeout once the goodbye is heard", () => {
    const h = harness();
    const onSettled = vi.fn();
    awaitGoodbye({ session: h.session, onSettled, timers: h.timers });

    h.emit("audio_start");
    h.emit("audio_stopped");
    h.advance(GOODBYE_TIMEOUT_MS * 2);
    expect(onSettled).toHaveBeenCalledTimes(1); // not twice
  });
});

describe("settles exactly once and cleans up", () => {
  it("ignores repeated audio_stopped events", () => {
    const h = harness();
    const onSettled = vi.fn();
    awaitGoodbye({ session: h.session, onSettled, timers: h.timers });

    h.emit("audio_start");
    h.emit("audio_stopped");
    h.emit("audio_stopped");
    h.advance(GOODBYE_TAIL_MS * 3);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("the returned cancel forces an immediate settle", () => {
    const h = harness();
    const onSettled = vi.fn();
    const cancel = awaitGoodbye({ session: h.session, onSettled, timers: h.timers });

    cancel();
    expect(onSettled).toHaveBeenCalledWith({ interrupt: true });
    cancel(); // idempotent
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("detaches its listeners after settling", () => {
    const h = harness();
    awaitGoodbye({ session: h.session, onSettled: vi.fn(), timers: h.timers });
    expect(h.listenerCount()).toBeGreaterThan(0);

    h.emit("audio_start");
    h.emit("audio_stopped");
    h.advance(GOODBYE_TAIL_MS);
    expect(h.listenerCount()).toBe(0);
  });
});

describe("the panel never gets stuck on 'Ending…'", () => {
  it("settles when Hope was ALREADY speaking as teardown began", () => {
    // The model can emit the goodbye audio and call end_voice_session in the
    // same turn, so audio_start fires before we attach. Without this the panel
    // hung on "Ending…" until the hard timeout.
    const h = harness();
    const onSettled = vi.fn();
    awaitGoodbye({ session: h.session, onSettled, timers: h.timers, alreadySpeaking: true });

    h.emit("audio_stopped"); // no audio_start will ever arrive
    h.advance(GOODBYE_TAIL_MS);
    expect(onSettled).toHaveBeenCalledWith({ interrupt: false });
  });

  it("fails fast enough that a stuck panel is never long-lived", () => {
    expect(GOODBYE_TIMEOUT_MS).toBeLessThanOrEqual(4000);
  });
});

describe("teardown cannot be blocked", () => {
  it("cancel() settles immediately even mid-goodbye — this is what End and X use", () => {
    const h = harness();
    const onSettled = vi.fn();
    const cancel = awaitGoodbye({ session: h.session, onSettled, timers: h.timers });

    h.emit("audio_start"); // Hope is mid-sentence
    cancel();
    expect(onSettled).toHaveBeenCalledWith({ interrupt: true });
  });

  it("the deadline alone settles it, with no audio events at all", () => {
    // The browser freeze happened because teardown waited on an event that
    // never came. Nothing here depends on one arriving.
    const h = harness();
    const onSettled = vi.fn();
    awaitGoodbye({ session: h.session, onSettled, timers: h.timers });

    h.advance(GOODBYE_TIMEOUT_MS);
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it("closes within a few seconds in every case", () => {
    // Whichever path wins, the user is never left looking at "Ending…".
    expect(Math.max(GOODBYE_TIMEOUT_MS, GOODBYE_TAIL_MS)).toBeLessThanOrEqual(4000);
  });
});
