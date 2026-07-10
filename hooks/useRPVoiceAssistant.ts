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
import { RealtimeSession } from "@openai/agents/realtime";
import {
  createRPHopeAgent,
  buildSessionConfig,
  REALTIME_MODEL,
  WORKFLOW_NAME,
} from "@/lib/voice/agent";
import { setVoiceBridge } from "@/lib/voice/bridge";
import { extractTranscript, type TranscriptTurn } from "@/lib/voice/transcript";
import { getPreferences } from "@/lib/voice/accessibilityPreferences";

export type ConnectionStatus =
  | "unknown"
  | "unconfigured"
  | "idle"
  | "connecting"
  | "connected"
  | "error";

export type Activity = "idle" | "listening" | "thinking" | "speaking";

export type Source = { title: string; heading: string; url: string };

const MAX_SESSION_MS = 45 * 60 * 1000;

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

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const session = sessionRef.current;
    sessionRef.current = null;
    setVoiceBridge(null);
    if (session) {
      try {
        session.close();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const end = useCallback(() => {
    cleanup();
    setActivity("idle");
    setMuted(false);
    setStatus("idle");
    // Conversation state is memory-only; clear it on end (privacy).
    setTranscript([]);
    setSources([]);
  }, [cleanup]);

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

    // Pre-flight microphone permission for a clear error before connecting.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
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
      const session = new RealtimeSession(agent, {
        transport: "webrtc",
        model: REALTIME_MODEL,
        config: buildSessionConfig(),
        workflowName: WORKFLOW_NAME,
      });
      sessionRef.current = session;

      session.on("history_updated", (history) => {
        setTranscript(extractTranscript(history));
      });
      session.on("audio_start", () => setActivity("speaking"));
      session.on("audio_stopped", () => setActivity("listening"));
      session.on("audio_interrupted", () => setActivity("listening"));
      session.on("agent_tool_start", () => setActivity("thinking"));
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
      });

      setStatus("connected");
      setActivity("listening");
      announce("Voice assistant connected and listening.");

      // Enforce the maximum session duration.
      timerRef.current = setTimeout(() => {
        setSessionExpired(true);
        cleanup();
        setStatus("idle");
        setActivity("idle");
        announce("The voice session reached its time limit. You can start a new one.");
      }, MAX_SESSION_MS);
    } catch {
      cleanup();
      setStatus("error");
      setError("Couldn't connect the voice session. Please try again.");
    }
  }, [router, announce, cleanup]);

  const toggleMute = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    const next = !muted;
    try {
      session.mute(next);
      setMuted(next);
      announce(next ? "Microphone muted." : "Microphone on.");
    } catch {
      /* transport may not support muting */
    }
  }, [muted, announce]);

  const stopSpeaking = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      session.interrupt();
      setActivity("listening");
    } catch {
      /* ignore */
    }
  }, []);

  const sendText = useCallback((text: string) => {
    const session = sessionRef.current;
    const clean = text.trim();
    if (!session || !clean) return;
    try {
      session.sendMessage(clean);
      setActivity("thinking");
    } catch {
      setError("Couldn't send that message. Please try again.");
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
    setSources([]);
  }, []);

  // Full cleanup on unmount.
  useEffect(() => cleanup, [cleanup]);

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
