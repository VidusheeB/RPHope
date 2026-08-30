"use client";

// Owns the RP Hope Realtime voice session end-to-end:
//   - probes whether the server has an OpenAI key
//   - mints a fresh ephemeral token per session and connects over WebRTC
//   - wires transcript/activity/error events and the navigation bridge
//   - exposes start/end/mute/stop/sendText/clear controls
//   - enforces a 45-minute cap and cleans up fully on unmount
//
// Conversation content is kept in memory only; nothing is persisted or logged.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { RealtimeSession, OpenAIRealtimeWebRTC } from "@openai/agents/realtime";
import {
  createRPHopeAgent,
  buildSessionConfig,
  REALTIME_MODEL,
  WORKFLOW_NAME,
  HOPE_INTRODUCTION,
} from "@/lib/voice/agent";
import { isExitPhrase } from "@/lib/voice/exitPhrases";
import { IDLE_TIMEOUT_MS, isCapacityError } from "@/lib/voice/capacity";
import { awaitGoodbye } from "@/lib/voice/goodbye";
import {
  setMicrophoneEnabled,
  releaseMedia,
  type MediaRefs,
} from "@/lib/voice/mediaSession";
import { setVoiceBridge } from "@/lib/voice/bridge";
import { extractTranscript, type TranscriptTurn } from "@/lib/voice/transcript";
import { getPreferences } from "@/lib/voice/accessibilityPreferences";

export type ConnectionStatus =
  | "unknown"
  | "unconfigured"
  | "idle"
  | "connecting"
  | "connected"
  | "ending"
  | "error";

export type Activity = "idle" | "listening" | "thinking" | "speaking";

export type Source = { title: string; heading: string; url: string };

const MAX_SESSION_MS = 45 * 60 * 1000;
/** Longest the UI may sit on "Ending…" before teardown is forced. */
const ENDING_WATCHDOG_MS = 5000;

export function useRPVoiceAssistant() {
  const router = useRouter();
  const pathname = usePathname();

  const [status, setStatus] = useState<ConnectionStatus>("unknown");
  const [activity, setActivity] = useState<Activity>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  const sessionRef = useRef<RealtimeSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // We own the microphone stream and the playback element rather than letting
  // the transport create them, so that ending can positively stop the mic
  // (track.stop(), which drops the browser's recording indicator) and silence
  // playback. The SDK's close() stops sender tracks but never pauses the audio
  // element it creates.
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const endingRef = useRef(false); // makes endSession idempotent
  const introducedRef = useRef(false); // intro plays once per session
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelGoodbyeRef = useRef<(() => void) | null>(null);
  // Mirrors `activity` for callbacks that must read it without re-subscribing.
  const activityRef = useRef<Activity>("idle");
  const handledTranscriptsRef = useRef<Set<string>>(new Set());
  // Event handlers are registered inside start() and outlive that closure, so
  // they reach endSession through a ref rather than capturing it.
  const endSessionRef = useRef<
    ((opts?: { spoken?: boolean; force?: boolean }) => void) | null
  >(null);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const announce = useCallback((message: string) => {
    // Toggle to guarantee the live region re-announces identical text.
    setAnnouncement("");
    window.setTimeout(() => setAnnouncement(message), 30);
  }, []);

  // Probe configuration once on mount.
  useEffect(() => {
    let alive = true;
    fetch("/api/openai/realtime-token")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setStatus(d?.configured ? "idle" : "unconfigured");
      })
      .catch(() => alive && setStatus("idle")); // assume possible; start() will verify
    return () => {
      alive = false;
    };
  }, []);

  const cleanup = useCallback((opts?: { interrupt?: boolean }) => {
    for (const ref of [timerRef, idleTimerRef]) {
      if (ref.current) {
        clearTimeout(ref.current);
        ref.current = null;
      }
    }

    // Drop any pending goodbye wait so its timer cannot fire after teardown.
    cancelGoodbyeRef.current = null;

    const refs: MediaRefs = {
      session: sessionRef.current,
      stream: micStreamRef.current,
      audioEl: audioElRef.current,
    };
    sessionRef.current = null;
    micStreamRef.current = null;
    audioElRef.current = null;
    setVoiceBridge(null);

    releaseMedia(refs, { interrupt: opts?.interrupt !== false });

    introducedRef.current = false;
    handledTranscriptsRef.current = new Set();
  }, []);

  /** Enable/disable the live microphone track. Disabling stops NEW audio being
   *  captured and sent; it makes no claim about audio already processed. */
  const setMicEnabled = useCallback((enabled: boolean) => {
    setMicrophoneEnabled(
      {
        session: sessionRef.current,
        stream: micStreamRef.current,
        audioEl: audioElRef.current,
      },
      enabled
    );
  }, []);

  /** End the conversation. Idempotent: the end_voice_session tool, the
   *  transcript fallback, the End button, the X, and unmount can all race. */
  const endSession = useCallback(
    (opts?: { spoken?: boolean; force?: boolean }) => {
      // `force` is how the End button, the X, and the watchdog get through even
      // when a goodbye is already in flight. Without it a teardown that stalled
      // left endingRef stuck true, silently disabling every later attempt to
      // end — the panel then reopened still showing "Ending…".
      if (endingRef.current && !opts?.force) return;
      if (opts?.force) cancelGoodbyeRef.current?.();
      endingRef.current = true;

      // Privacy first: the microphone goes off immediately, before we wait on
      // any goodbye audio.
      setMicEnabled(false);
      setMuted(true);
      setStatus("ending");
      announce("Conversation ended.");

      const finish = (finishOpts?: { interrupt?: boolean }) => {
        cleanup(finishOpts);
        endingRef.current = false;
        setActivity("idle");
        setMuted(false);
        setStatus("idle");
        // Conversation state is memory-only; clear it on end (privacy).
        setTranscript([]);
        setSources([]);
      };

      if (!opts?.spoken || !sessionRef.current) {
        finish();
        return;
      }

      // Wait for the goodbye to actually be SPOKEN, then close a beat later.
      // See lib/voice/goodbye.ts for why a bare once("audio_stopped") cut Hope
      // off mid-word, and why the deadline (not the audio event) is primary.
      cancelGoodbyeRef.current = awaitGoodbye({
        session: sessionRef.current as unknown as Parameters<typeof awaitGoodbye>[0]["session"],
        // If Hope is mid-sentence already, audio_start has been and gone.
        alreadySpeaking: activityRef.current === "speaking",
        onSettled: ({ interrupt }) => finish({ interrupt }),
      });
    },
    [cleanup, announce, setMicEnabled]
  );

  endSessionRef.current = endSession;

  /** Restart the idle countdown. An abandoned session otherwise holds an
   *  OpenAI realtime slot (and an open microphone) until the 45-minute cap,
   *  which is what starves capacity when several people use the assistant. */
  const touchActivity = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!sessionRef.current) return;
    idleTimerRef.current = setTimeout(() => {
      if (!sessionRef.current) return;
      announce("The conversation ended because there was no activity.");
      endSessionRef.current?.();
    }, IDLE_TIMEOUT_MS);
  }, [announce]);

  const start = useCallback(async () => {
    setError(null);
    setSessionExpired(false);
    if (sessionRef.current) return; // no duplicate sessions

    // Capability checks with recoverable messages.
    if (typeof RTCPeerConnection === "undefined") {
      setStatus("error");
      setError(
        "This browser doesn't support live voice (WebRTC). You can still type your questions below, or try Chrome, Edge, or Safari."
      );
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("No microphone is available. You can type your questions below instead.");
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setStatus("error");
      setError("You appear to be offline. Reconnect and try again.");
      return;
    }

    setStatus("connecting");

    // Acquire the microphone up front: it gives a clear permission error before
    // connecting, AND this exact stream is handed to the transport below so we
    // keep a handle on the track we later need to disable (mute) and stop (end).
    try {
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setStatus("error");
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(
          "Microphone access was blocked. Allow the microphone in your browser's site settings, then start again — or type your question below."
        );
      } else if (name === "NotFoundError") {
        setError("No microphone was found. You can type your question below instead.");
      } else {
        setError("Couldn't access the microphone. You can type your question below instead.");
      }
      return;
    }

    // Mint a fresh ephemeral token.
    let ephemeralKey: string;
    try {
      const res = await fetch("/api/openai/realtime-token", { method: "POST" });
      if (res.status === 503) {
        setStatus("unconfigured");
        return;
      }
      if (!res.ok) throw new Error(`token ${res.status}`);
      const data = await res.json();
      ephemeralKey = data?.value;
      if (!ephemeralKey) throw new Error("no token");
    } catch {
      setStatus("error");
      setError("Couldn't start the voice session. Please try again in a moment.");
      return;
    }

    // Build the session and connect over WebRTC.
    try {
      const agent = createRPHopeAgent();

      // Own the playback element so cleanup can positively silence Hope. The
      // transport would otherwise create a detached <audio> we can't reach.
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioElRef.current = audioEl;

      const session = new RealtimeSession(agent, {
        transport: new OpenAIRealtimeWebRTC({
          audioElement: audioEl,
          mediaStream: micStreamRef.current ?? undefined,
        }),
        model: REALTIME_MODEL,
        config: buildSessionConfig(),
        workflowName: WORKFLOW_NAME,
      });
      sessionRef.current = session;

      session.on("history_updated", (history) => {
        const turns = extractTranscript(history);
        setTranscript(turns);
        touchActivity();

        // Fallback exit detection. Only COMPLETED user turns are considered —
        // acting on an in-progress transcript would hang up on someone who is
        // still mid-sentence ("bye…" in "maybe"). Each turn is judged once.
        for (const turn of turns) {
          if (turn.role !== "user" || turn.inProgress) continue;
          if (handledTranscriptsRef.current.has(turn.id)) continue;
          handledTranscriptsRef.current.add(turn.id);
          if (isExitPhrase(turn.text)) endSessionRef.current?.({ spoken: true });
        }
      });
      session.on("audio_start", () => {
        touchActivity();
        activityRef.current = "speaking";
        setActivity("speaking");
      });
      session.on("audio_stopped", () => {
        activityRef.current = "listening";
        setActivity("listening");
      });
      session.on("audio_interrupted", () => {
        activityRef.current = "listening";
        setActivity("listening");
      });
      session.on("agent_tool_start", () => {
        activityRef.current = "thinking";
        setActivity("thinking");
      });
      session.on("agent_tool_end", (_ctx, _agent, tool, result) => {
        setActivity("listening");
        if (tool.name === "ask_rp_expert" || tool.name === "search_rp_hope") {
          try {
            const parsed = JSON.parse(result);
            const found: Source[] = parsed.sources ?? parsed.results ?? [];
            if (Array.isArray(found) && found.length) {
              setSources(
                found
                  .filter((s) => s && s.url)
                  .map((s) => ({
                    title: s.title ?? s.heading ?? "Source",
                    heading: s.heading ?? "",
                    url: s.url,
                  }))
              );
            }
          } catch {
            /* ignore non-JSON tool output */
          }
        }
      });
      session.on("error", (e) => {
        // Sanitized, user-facing. Don't surface raw error detail.
        console.error("Realtime session error", (e as { type?: string })?.type ?? "");
        setStatus("error");
        setError("The voice connection had a problem. You can start again or type your question.");
      });

      await session.connect({ apiKey: ephemeralKey });

      // Install the navigation bridge now that we're connected.
      setVoiceBridge({
        navigate: (href: string) => {
          router.push(href);
          window.setTimeout(() => {
            const h1 = document.querySelector("main h1") as HTMLElement | null;
            if (h1) {
              h1.setAttribute("tabindex", "-1");
              h1.focus({ preventScroll: true });
            }
            window.scrollTo({ top: 0, behavior: "smooth" });
            announce(`Now on ${document.title || href}`);
          }, 120);
        },
        goBack: () => {
          if (window.history.length > 1) {
            router.back();
            return true;
          }
          return false;
        },
        announce,
        getPathname: () => pathnameRef.current,
        endSession: () => endSessionRef.current?.({ spoken: true }),
      });

      setStatus("connected");
      setActivity("listening");
      touchActivity(); // arm the idle countdown
      announce("Hope is listening.");

      // Speak the introduction exactly once per session. The user pressed
      // "Start conversation" — this is the reply to that, so nothing needs to
      // be said first. Guarded by a ref so a reconnect or a re-render can't
      // trigger a second one.
      if (!introducedRef.current) {
        introducedRef.current = true;
        try {
          session.transport.sendEvent({
            type: "response.create",
            response: {
              instructions: `Say exactly this, and nothing else: "${HOPE_INTRODUCTION}"`,
            },
          });
        } catch {
          // Non-fatal: the session is usable, the user just wasn't greeted.
        }
      }

      // Enforce the maximum session duration.
      timerRef.current = setTimeout(() => {
        setSessionExpired(true);
        cleanup();
        setStatus("idle");
        setActivity("idle");
        announce("The voice session reached its time limit. You can start a new one.");
      }, MAX_SESSION_MS);
    } catch (err) {
      // Log the real cause — a bare catch here made this failure undiagnosable.
      console.error("[voice] connect failed:", err);
      cleanup();
      setStatus("error");
      // When OpenAI rate-limits (HTTP 429), it returns a JSON error body where
      // the SDK expects an SDP answer, so the failure surfaces as a confusing
      // "Failed to parse SessionDescription". Name the likely cause instead of
      // blaming the connection generically.
      const detail = err instanceof Error ? err.message : "";
      setError(
        isCapacityError(detail)
          ? "The voice service is busy right now (too many sessions started in a short time). Please wait a minute and try again."
          : "Couldn't connect the voice session. Please try again."
      );
    }
  }, [router, announce, cleanup]);

  /** Mute is a privacy control, NOT a disconnect: the Realtime session stays
   *  open and Hope's own output audio is untouched. */
  const toggleMute = useCallback(() => {
    if (!sessionRef.current) return;
    const next = !muted;
    setMicEnabled(!next);
    setMuted(next);
    announce(next ? "Muted — Hope cannot hear you." : "Listening.");
  }, [muted, announce, setMicEnabled]);

  /** Interrupt Hope's current spoken response. Does not mute the microphone and
   *  does not end the conversation. */
  const stopSpeaking = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      // Sends response.cancel + output_audio_buffer.clear on WebRTC.
      session.interrupt();
    } catch {
      /* ignore */
    }
    // Return to whichever state the microphone is ACTUALLY in.
    setActivity("listening");
    announce(muted ? "Muted — Hope cannot hear you." : "Listening.");
  }, [muted, announce]);

  const sendText = useCallback((text: string) => {
    const session = sessionRef.current;
    const clean = text.trim();
    if (!session || !clean) return;
    try {
      session.sendMessage(clean);
      touchActivity(); // typing is activity too
      setActivity("thinking");
    } catch {
      setError("Couldn't send that message. Please try again.");
    }
  }, [touchActivity]);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
    setSources([]);
  }, []);

  // Watchdog, deliberately independent of the goodbye sequencer so a bug in
  // that path cannot leave the panel stuck on "Ending…".
  useEffect(() => {
    if (status !== "ending") return;
    const t = window.setTimeout(() => {
      endSessionRef.current?.({ force: true });
    }, ENDING_WATCHDOG_MS);
    return () => window.clearTimeout(t);
  }, [status]);

  // Full cleanup on unmount.
  useEffect(() => cleanup, [cleanup]);

  // End button and panel X: immediate, unconditional teardown, no goodbye.
  const end = useCallback(() => endSession({ force: true }), [endSession]);

  return {
    status,
    activity,
    muted,
    error,
    transcript,
    sources,
    announcement,
    sessionExpired,
    preferences: getPreferences(),
    start,
    end,
    toggleMute,
    stopSpeaking,
    sendText,
    clearTranscript,
  };
}
