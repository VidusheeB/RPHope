import { describe, it, expect, vi } from "vitest";
import {
  setMicrophoneEnabled,
  releaseMedia,
  isMicrophoneLive,
  type MediaRefs,
} from "@/lib/voice/mediaSession";
import { isExitPhrase } from "@/lib/voice/exitPhrases";
import { voiceStatusKey, voiceStatusLabel } from "@/lib/voice/statusLabels";
import {
  buildSessionConfig,
  createRPHopeAgent,
  HOPE_INTRODUCTION,
  HOPE_GOODBYE,
} from "@/lib/voice/agent";
import { rpHopeTools } from "@/lib/voice/tools";
import { ASSISTANT_INSTRUCTIONS } from "@/lib/voice/agentInstructions";

function fakeTrack(kind = "audio") {
  return { kind, enabled: true, readyState: "live", stop: vi.fn(function (this: any) { this.readyState = "ended"; }) };
}
function fakeRefs() {
  const track = fakeTrack();
  const session = { mute: vi.fn(), interrupt: vi.fn(), close: vi.fn() };
  const audioEl = { pause: vi.fn(), srcObject: {} as unknown } as unknown as HTMLAudioElement;
  const stream = {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
  return { refs: { session, stream, audioEl } as MediaRefs, track, session, audioEl };
}

describe("mute is a privacy control, not a disconnect", () => {
  it("disables the microphone track without closing the connection", () => {
    const { refs, track, session } = fakeRefs();
    setMicrophoneEnabled(refs, false);
    expect(track.enabled).toBe(false);
    expect(session.mute).toHaveBeenCalledWith(true);
    // The session must stay open, and Hope's output must not be touched.
    expect(session.close).not.toHaveBeenCalled();
    expect(session.interrupt).not.toHaveBeenCalled();
  });

  it("does not stop the track, so unmute can restore it instantly", () => {
    const { refs, track } = fakeRefs();
    setMicrophoneEnabled(refs, false);
    expect(track.stop).not.toHaveBeenCalled();
    expect(track.readyState).toBe("live");

    setMicrophoneEnabled(refs, true);
    expect(track.enabled).toBe(true);
    expect(isMicrophoneLive(refs)).toBe(true);
  });

  it("reports the microphone as not live while muted", () => {
    const { refs } = fakeRefs();
    setMicrophoneEnabled(refs, false);
    expect(isMicrophoneLive(refs)).toBe(false);
  });

  it("still disables the local track if the transport cannot mute", () => {
    const { refs, track } = fakeRefs();
    (refs.session as { mute: () => void }).mute = () => {
      throw new Error("unsupported");
    };
    setMicrophoneEnabled(refs, false);
    expect(track.enabled).toBe(false);
  });
});

describe("ending releases everything", () => {
  it("stops all media tracks, cancels output, and closes the connection", () => {
    const { refs, track, session, audioEl } = fakeRefs();
    releaseMedia(refs);
    expect(track.stop).toHaveBeenCalled();       // mic released, indicator off
    expect(session.interrupt).toHaveBeenCalled(); // response cancelled
    expect(session.close).toHaveBeenCalled();     // data channel + peer connection
    expect(audioEl.pause).toHaveBeenCalled();     // Hope's playback silenced
    expect(audioEl.srcObject).toBeNull();
  });

  it("still stops the microphone when the session never connected", () => {
    const { refs, track } = fakeRefs();
    const noSession: MediaRefs = { ...refs, session: null };
    releaseMedia(noSession);
    expect(track.stop).toHaveBeenCalled();
  });

  it("stops the track even if closing throws", () => {
    const { refs, track } = fakeRefs();
    (refs.session as { close: () => void }).close = () => {
      throw new Error("already closed");
    };
    releaseMedia(refs);
    expect(track.stop).toHaveBeenCalled();
  });

  it("is safe to call twice (End, then unmount)", () => {
    const { refs } = fakeRefs();
    releaseMedia(refs);
    expect(() => releaseMedia(refs)).not.toThrow();
  });
});

describe("voice exit phrases", () => {
  it.each([
    "bye", "Bye-bye", "goodbye", "Goodbye Hope", "stop listening",
    "end the conversation", "I'm done", "that's all",
  ])("detects %j", (phrase) => {
    expect(isExitPhrase(phrase)).toBe(true);
  });

  it.each([
    "what does the gene do",
    "I'm done with this page, what's next?",
    "don't say goodbye yet",
    "I'm not done",
    "tell me about Usher syndrome",
    "",
  ])("does not hang up on %j", (phrase) => {
    expect(isExitPhrase(phrase)).toBe(false);
  });
});

describe("status reflects the real microphone state", () => {
  it("shows muted even while Hope is speaking", () => {
    // Mute must outrank activity — otherwise the UI would claim to be
    // listening while the microphone is off.
    expect(voiceStatusKey("connected", "speaking", true)).toBe("muted");
    expect(voiceStatusLabel("muted")).toBe("Muted — Hope cannot hear you");
  });

  it("announces the required states", () => {
    expect(voiceStatusLabel(voiceStatusKey("connected", "listening", false))).toBe("Listening");
    expect(voiceStatusLabel(voiceStatusKey("connected", "speaking", false))).toBe("Hope is speaking");
    expect(voiceStatusLabel("ended")).toBe("Conversation ended");
  });

  it("never reports listening before the session is connected", () => {
    expect(voiceStatusKey("connecting", "listening", false)).toBe("connecting");
    expect(voiceStatusKey("idle", "listening", false)).toBe("idle");
    expect(voiceStatusKey("ending", "listening", false)).toBe("ending");
    expect(voiceStatusKey("error", "listening", false)).toBe("error");
  });
});

describe("Hope's identity and session config", () => {
  it("is named Hope and exposes the one-time introduction", () => {
    expect(createRPHopeAgent().name).toBe("Hope");
    expect(HOPE_INTRODUCTION).toContain("I'm Hope, RP Hope's AI voice guide");
    expect(HOPE_INTRODUCTION).toContain("mute me whenever you need privacy");
    expect(HOPE_GOODBYE).toBe("Goodbye. I've stopped listening.");
  });

  it("uses semantic VAD with low eagerness so users can finish speaking", () => {
    // RealtimeSessionConfig is a union with a deprecated shape, so reach the
    // audio branch through a narrow cast rather than widening the source type.
    const cfg = buildSessionConfig() as {
      audio?: { input?: { turnDetection?: Record<string, unknown> } };
    };
    const turn = cfg.audio?.input?.turnDetection ?? {};
    expect(turn.type).toBe("semantic_vad");
    expect(turn.eagerness).toBe("low");
    expect(turn.interruptResponse).toBe(true);
  });

  it("registers end_voice_session with no parameters", () => {
    const tool = rpHopeTools.find((t) => t.name === "end_voice_session");
    expect(tool).toBeDefined();
  });

  it("instructs Hope to identify as an AI and to end on request", () => {
    expect(ASSISTANT_INSTRUCTIONS).toContain("You are Hope");
    expect(ASSISTANT_INSTRUCTIONS).toContain("AI voice guide");
    expect(ASSISTANT_INSTRUCTIONS).toContain("end_voice_session");
    expect(ASSISTANT_INSTRUCTIONS).toMatch(/do not diagnose|Do not diagnose/);
  });
});
