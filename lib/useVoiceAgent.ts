"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { speak, cancelSpeech, pauseSpeech, resumeSpeech, isSpeechSupported } from "./speech";

// ---------------------------------------------------------------------------
// Minimal types for the Web Speech API (webkitSpeechRecognition), which ships
// in Chrome/Edge/Safari but isn't in the TS DOM lib. We only type what we use.
// ---------------------------------------------------------------------------
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type AgentStatus =
  | "off" // not enabled yet
  | "unsupported" // browser can't do voice
  | "idle" // not in a conversation — listening only for the wake word
  | "listening" // in an active conversation — just talk, no wake word needed
  | "thinking" // asking the assistant
  | "confirming" // asked "say yes to go there"
  | "speaking" // reading something aloud
  | "paused"; // speech paused mid-answer; say "continue" to resume

// The visitor must ADDRESS the assistant by name before each command, so it
// doesn't react to every passing remark. "Claude" plus its common mis-hears.
const NAME = "(claude|cloud|clod|claud|clawed|cloud's|clyde|claudia|cloudy|cload|chlode)";
const ADDRESS = new RegExp(`\\b${NAME}\\b`, "i");
const INTRO =
  "To talk to me, start with my name. Say, Claude, then what you want — for example, Claude, take me to the stories page, or, Claude, pause. I'll only act when you begin with, Claude. Say, Claude, turn off, when you're done.";

// Strip the address word (and any leading hello/hey) off a command, leaving the
// actual request: "Claude, tell me Rosie's story" → "tell me Rosie's story".
function stripAddress(text: string): string {
  return text
    .replace(/\b(hello|hey|hi|ok|okay)\b/gi, " ")
    .replace(new RegExp(`\\b${NAME}\\b`, "gi"), " ")
    .replace(/^[\s,.:;!?-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const TURN_OFF =
  /\bturn (it |the (voice|mic|assistant) )?off\b|\bturn off\b|\bshut (it |down|off)\b|\bdisable\b|\bclose (the )?(voice|mic|assistant)\b/;
const GOODBYE =
  /\b(goodbye|good bye|bye|that's all|that is all|i'?m done|go to sleep|never mind|stop listening)\b/;

// ---------------------------------------------------------------------------
// Page guide. On arrival we DESCRIBE the page and list what can be explored
// (each story, each section) rather than auto-reading the whole thing. Pulled
// generically from the DOM so it works on any page without per-page wiring; a
// page may override the description with a [data-voice-intro] element.
// ---------------------------------------------------------------------------
type PageItem = { label: string; text: string };

function getPageItems(): PageItem[] {
  const main = typeof document !== "undefined" ? document.getElementById("main") : null;
  if (!main) return [];
  const items: PageItem[] = [];
  main.querySelectorAll("h2").forEach((h) => {
    const label = h.textContent?.trim() ?? "";
    if (!label) return;
    let text = `${label}. `;
    let n = h.nextElementSibling as HTMLElement | null;
    while (n && !/^H[12]$/.test(n.tagName)) {
      text += `${n.innerText} `;
      n = n.nextElementSibling as HTMLElement | null;
    }
    items.push({ label, text: text.trim() });
  });
  return items;
}

function getPageIntro(): string {
  const main = typeof document !== "undefined" ? document.getElementById("main") : null;
  if (!main) return "";
  const explicit = main.querySelector<HTMLElement>("[data-voice-intro]");
  if (explicit?.innerText.trim()) return explicit.innerText.trim();
  const h1 = main.querySelector("h1")?.textContent?.trim() ?? "";
  let lead = ""; // first reasonably long paragraph = the page's lead description
  for (const p of Array.from(main.querySelectorAll("p"))) {
    const txt = (p as HTMLElement).innerText.trim();
    if (txt.length > 80) {
      lead = txt;
      break;
    }
  }
  return [h1, lead].filter(Boolean).join(". ");
}

// Match a spoken request to one of the page's items (a story, a section). Hits
// on the full label or any distinctive word of it ("rosie", "lemay-pelletier").
function matchPageItem(query: string, items: PageItem[]): PageItem | null {
  const q = query.toLowerCase();
  for (const it of items) {
    if (q.includes(it.label.toLowerCase())) return it;
  }
  for (const it of items) {
    const tokens = it.label
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4);
    if (tokens.some((tok) => q.includes(tok))) return it;
  }
  return null;
}

// Join labels into a spoken list: "a, b, or c".
function joinWithOr(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]}, or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, or ${labels[labels.length - 1]}`;
}

export function useVoiceAgent() {
  const router = useRouter();
  const [status, setStatus] = useState<AgentStatus>("off");
  const [heard, setHeard] = useState(""); // caption of what the user said
  const [message, setMessage] = useState(""); // caption of what Claude said

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const enabledRef = useRef(false);
  const speakingRef = useRef(false);
  const statusRef = useRef<AgentStatus>("off");
  const pendingRef = useRef<{ label: string; href: string; query: string } | null>(null);
  // Rolling conversation history so the assistant talks naturally across turns.
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const sessionRef = useRef(false);
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The words Claude is currently speaking. His intro and page guides include
  // the word "Claude", so his TTS echoed into the mic would match the address
  // gate — we reject any transcript that's mostly his own current words.
  const spokenWordsRef = useRef<Set<string>>(new Set());
  // The recognizer delivers a single spoken sentence as SEVERAL final results
  // (it finalizes on every brief mid-sentence pause). We buffer those pieces and
  // only act once the visitor has truly stopped talking — so a question isn't
  // chopped in half and Claude doesn't answer before they've finished.
  const utterBufferRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const END_OF_SPEECH_MS = 950;

  const setS = useCallback((s: AgentStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  const restartRecognition = useCallback(() => {
    if (!enabledRef.current || speakingRef.current) return;
    try {
      recRef.current?.start();
    } catch {
      /* start() throws if already started — safe to ignore */
    }
  }, []);

  // Once a conversation is open it stays open — the assistant keeps listening
  // until the visitor says "goodbye" / "turn off". No silence timeout, because
  // dropping out mid-thought is exactly what frustrated users.
  const keepSessionAlive = useCallback(() => {
    sessionRef.current = true;
  }, []);

  const settleAfterSpeech = useCallback(() => {
    if (sessionRef.current) {
      keepSessionAlive();
      setS("listening");
    } else {
      setS("idle");
    }
  }, [keepSessionAlive, setS]);

  const say = useCallback(
    (text: string, opts: { caption?: string; after?: () => void } = {}) => {
      setMessage(opts.caption ?? text);
      spokenWordsRef.current = new Set(text.toLowerCase().match(/[a-z']+/g) ?? []);
      speakingRef.current = true;
      // NOTE: we deliberately keep the mic LISTENING while Claude speaks so the
      // visitor can interrupt ("stop"). onFinalTranscript filters out Claude
      // hearing itself (only short utterances with an interrupt word act).
      setS("speaking");
      // Respell "Claude" phonetically for the synthesizer only — many TTS voices
      // say it as "Clode" (rhymes with "code"); "Clawed" gives the correct
      // /klɔːd/. The on-screen caption keeps the real spelling.
      speak(text.replace(/\bClaude\b/g, "Clawed"), {
        onEnd: () => {
          speakingRef.current = false;
          spokenWordsRef.current = new Set();
          if (opts.after) opts.after();
          else settleAfterSpeech();
          restartRecognition();
        },
      });
    },
    [setS, settleAfterSpeech, restartRecognition]
  );

  const readText = useCallback(
    (text: string, caption?: string) => {
      const clean = text.replace(/\s+/g, " ").trim();
      if (!clean) {
        say("I couldn't find that on this page.");
        return;
      }
      say(clean, { caption: caption ?? "Reading aloud… (say “stop” to stop)" });
    },
    [say]
  );

  const mainText = useCallback(() => {
    const main = document.getElementById("main");
    return (main?.innerText ?? "").trim();
  }, []);

  // Try to read a specific thing the visitor named on the CURRENT page —
  // VERBATIM (content governance: a story/section is reviewed page content, not
  // an AI paraphrase). Matches a page item (a story card, a content block) or a
  // labelled section. Returns true if it found something to read; false lets the
  // caller fall back to the conversational brain.
  const tryReadOnPage = useCallback(
    (query: string): boolean => {
      const item = matchPageItem(query, getPageItems());
      if (item) {
        readText(item.text, `Reading: ${item.label}`);
        return true;
      }
      return false;
    },
    [readText]
  );

  const readCurrentPage = useCallback(() => {
    readText(mainText(), "Reading this page aloud… (say “Claude, stop” to stop)");
  }, [readText, mainText]);

  // On arrival, DESCRIBE the page and offer choices — never auto-read the whole
  // thing. The visitor then picks ("Claude, tell me Rosie's story") or asks for
  // the full page ("Claude, read the whole page").
  const describeCurrentPage = useCallback(() => {
    const intro = getPageIntro();
    const labels = getPageItems().map((i) => i.label);
    let speech = intro || "Here's the page.";
    if (labels.length) {
      speech += ` You can say, Claude, read the whole page — or pick one of these: ${joinWithOr(
        labels
      )}. Which would you like?`;
    } else {
      speech += ` Say, Claude, read the whole page, to hear it.`;
    }
    say(speech, { caption: "Say “Claude, read the whole page”, or pick one." });
  }, [say]);

  // After a client-side navigation the new page isn't in <main> yet. Poll until
  // the content actually changes, THEN describe it — fixes describing the page
  // you just left. Gives up after ~5s.
  const guideAfterNavigation = useCallback(
    (prevText: string) => {
      let attempts = 0;
      const tick = () => {
        const now = mainText();
        if ((now.length > 40 && now !== prevText) || attempts >= 16) {
          describeCurrentPage();
          return;
        }
        attempts += 1;
        setTimeout(tick, 300);
      };
      setTimeout(tick, 300);
    },
    [mainText, describeCurrentPage]
  );

  // readQuery: undefined = don't read; null = read whole page; string = read the
  // section answering that question.
  const navigateTo = useCallback(
    (href: string, readQuery?: string | null) => {
      keepSessionAlive();
      if (/^https?:\/\//.test(href)) {
        window.open(href, "_blank", "noopener,noreferrer");
        say("I've opened that in a new tab.");
        return;
      }
      const prev = mainText();
      router.push(href);
      if (readQuery !== undefined) {
        setS("thinking");
        guideAfterNavigation(prev);
      } else {
        say("Here you go. Just tell me what's next.");
      }
    },
    [router, say, mainText, guideAfterNavigation, keepSessionAlive, setS]
  );

  const teardown = useCallback(() => {
    enabledRef.current = false;
    sessionRef.current = false;
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
    utterBufferRef.current = "";
    cancelSpeech();
    speakingRef.current = false;
    try {
      recRef.current?.abort();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    document.cookie = "rphope_voice=; path=/; max-age=0; samesite=lax";
    setS("off");
    setHeard("");
    setMessage("");
  }, [setS]);

  // The main brain: a natural, multi-turn conversation grounded ONLY in the
  // website's reviewed content (server-side fence — see app/api/assistant). It
  // may answer, simplify, analogize, or suggest a page to navigate to. The
  // instructions/personality live in lib/assistantInstructions.ts (editable).
  const converse = useCallback(
    async (message: string) => {
      setS("thinking");
      keepSessionAlive();
      historyRef.current.push({ role: "user", content: message });
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            history: historyRef.current.slice(-8),
            path: window.location.pathname,
          }),
        });
        const data = (await res.json()) as { reply: string };
        const reply = data.reply?.trim() || "I'm not sure how to answer that.";
        historyRef.current.push({ role: "assistant", content: reply });
        if (historyRef.current.length > 16) {
          historyRef.current = historyRef.current.slice(-16);
        }
        say(reply); // pure natural speech — navigation is its own "take me to" command
      } catch {
        say("Sorry, I had trouble reaching my brain. Could you say that again?");
      }
    },
    [say, setS, keepSessionAlive]
  );

  // Explicit navigation ("take me to the RPGR page"). Uses the bounded
  // /api/navigate to resolve a real href, then confirms before going. When the
  // target is vague ("take me there"), we resolve from the last thing Claude
  // said (which named the page).
  const navigateByQuery = useCallback(
    async (raw: string) => {
      setS("thinking");
      keepSessionAlive();
      const stripped = raw
        .toLowerCase()
        .replace(/\b(take|bring|me|to|the|go|open|show|navigate|pull|up|jump|visit|head|please|there|page|over)\b/g, "")
        .trim();
      const lastClaude = [...historyRef.current].reverse().find((h) => h.role === "assistant")?.content;
      const query = stripped.length >= 3 ? raw : lastClaude || raw;
      try {
        const res = await fetch("/api/navigate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const data = (await res.json()) as {
          suggestions: { label: string; href: string }[];
        };
        const top = data.suggestions?.[0];
        if (!top) {
          say("I'm not sure which page you mean — what are you looking for?");
          return;
        }
        pendingRef.current = { ...top, query };
        say(`I can take you to ${top.label}. Say yes to go there.`, {
          after: () => setS("confirming"),
        });
      } catch {
        say("I couldn't find that page just now.");
      }
    },
    [say, setS, keepSessionAlive]
  );

  const handleCommand = useCallback(
    (raw: string) => {
      const t = raw.toLowerCase().trim();
      keepSessionAlive();
      if (!t) {
        setS("listening");
        return;
      }
      if (TURN_OFF.test(t)) {
        say("Turning off the voice assistant. Goodbye.", { after: teardown });
        return;
      }
      if (GOODBYE.test(t)) {
        sessionRef.current = false;
        if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
        utterBufferRef.current = "";
        cancelSpeech();
        speakingRef.current = false;
        say("Okay. Say, Claude, when you need me.", { after: () => setS("idle") });
        return;
      }
      if (/\b(stop|quiet|shush|silence|pause|hush|enough)\b/.test(t)) {
        cancelSpeech();
        speakingRef.current = false;
        setMessage("");
        setS("listening");
        restartRecognition();
        return;
      }
      if (/\bgo back\b|\bprevious page\b/.test(t)) {
        const prev = mainText();
        router.back();
        setS("thinking");
        guideAfterNavigation(prev);
        return;
      }
      if (/\bread (this|the|it|whole )?(page|aloud)\b|\bread it\b|\bread everything\b/.test(t) || t === "read") {
        readCurrentPage();
        return;
      }
      // Explicit "go somewhere" intent → bounded navigation.
      if (/\b(take me|bring me|go to|open|show me|navigate to|pull up|jump to|visit|head to)\b/.test(t)) {
        void navigateByQuery(raw);
        return;
      }
      // A specific thing named on THIS page (a story, a content block) → read it
      // verbatim. Falls through to conversation when nothing on-page matches.
      if (tryReadOnPage(raw)) return;
      // Everything else → the natural, website-grounded conversation.
      void converse(raw);
    },
    [
      keepSessionAlive,
      teardown,
      say,
      setS,
      restartRecognition,
      mainText,
      router,
      guideAfterNavigation,
      readCurrentPage,
      navigateByQuery,
      tryReadOnPage,
      converse,
    ]
  );

  // Pause/Resume/Stop the current spoken answer. Shared by the on-screen buttons
  // (reliable, keyboard-operable — WCAG) and the spoken barge-in words below.
  const pausePlayback = useCallback(() => {
    if (!speakingRef.current || statusRef.current === "paused") return;
    pauseSpeech();
    setS("paused");
    setMessage("Paused — say “continue” to resume.");
  }, [setS]);

  const resumePlayback = useCallback(() => {
    if (statusRef.current !== "paused") return;
    resumeSpeech();
    setS("speaking");
  }, [setS]);

  const clearUtteranceBuffer = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = null;
    utterBufferRef.current = "";
  }, []);

  const stopPlayback = useCallback(() => {
    cancelSpeech();
    speakingRef.current = false;
    clearUtteranceBuffer();
    setMessage("");
    setS("listening");
    keepSessionAlive();
    restartRecognition();
  }, [setS, keepSessionAlive, restartRecognition, clearUtteranceBuffer]);

  // Accumulate the pieces of one spoken sentence, then dispatch the WHOLE thing
  // after a short silence — never a half-sentence, never an answer mid-thought.
  const queueUserSpeech = useCallback(
    (text: string) => {
      keepSessionAlive();
      utterBufferRef.current = `${utterBufferRef.current} ${text}`.trim();
      setHeard(utterBufferRef.current);
      setS("listening");
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      flushTimerRef.current = setTimeout(() => {
        const full = utterBufferRef.current.trim();
        flushTimerRef.current = null;
        utterBufferRef.current = "";
        if (full) handleCommand(full);
      }, END_OF_SPEECH_MS);
    },
    [keepSessionAlive, setS, handleCommand]
  );

  // BARGE-IN handling while Claude is speaking. The mic stays live during speech,
  // so it may hear (a) the visitor interrupting or (b) Claude's own TTS echoed
  // back. We only ACT on a SHORT utterance containing an interrupt word — that's
  // a real interruption; long transcripts are almost always Claude hearing itself.
  //
  // Called for BOTH interim and final results: interim fires the instant a word
  // is recognized (immediate "stop"/"pause"), so we don't wait for a final
  // transcript that may never settle while TTS audio fills the mic. `maxWords` is
  // tighter for interim (pure control words only); `runRest` lets a final
  // "stop, tell me about X" also run the trailing command. Returns true if it
  // consumed the input.
  const tryInterrupt = useCallback(
    (raw: string, maxWords: number, runRest: boolean): boolean => {
      const text = raw.trim();
      const t = text.toLowerCase();
      if (t.split(/\s+/).length > maxWords) return false;

      const isResume = /\b(continue|resume|keep going|carry on|go on|unpause|keep talking)\b/.test(t);
      const isPause =
        !isResume &&
        /\b(pause|hold on|hang on|one moment|one second)\b/.test(t) &&
        !/\bstop\b/.test(t);
      const isStop =
        /\b(stop|quiet|shush|enough|cancel|never mind|shut up|hey claude|hello claude|hi claude|okay stop)\b/.test(t);

      // While paused: only "continue" (resume) or "stop" (cancel) apply.
      if (statusRef.current === "paused") {
        if (isResume) {
          setHeard(text);
          resumePlayback();
          return true;
        }
        if (isStop) {
          setHeard(text);
          stopPlayback();
          return true;
        }
        return false;
      }

      if (isPause) {
        setHeard(text);
        pausePlayback();
        return true;
      }
      if (!isStop) return false;

      setHeard(text);
      stopPlayback();
      // "stop, tell me about X" → also run the remainder as a fresh command.
      if (runRest) {
        const rest = text
          .replace(/^.*?\b(stop|quiet|shush|enough|cancel|never mind|shut up|claude)\b[\s,.!]*/i, "")
          .trim();
        if (rest.length > 3) handleCommand(rest);
      }
      return true;
    },
    [pausePlayback, resumePlayback, stopPlayback, handleCommand]
  );

  // Interim results arrive mid-word, before the recognizer finalizes — this is
  // what makes an addressed "Claude, pause/stop/continue" feel IMMEDIATE. Only
  // while Claude is speaking/paused, and only if it's addressed to him (so his
  // own echoed sentence is ignored).
  // True when a transcript heard during speech is mostly Claude's own words
  // echoed back through the mic (no hardware echo-cancellation on TTS output).
  const isLikelyEcho = useCallback((transcript: string): boolean => {
    const words = transcript.toLowerCase().match(/[a-z']+/g) ?? [];
    if (words.length === 0) return true;
    const fromClaude = words.filter((w) => spokenWordsRef.current.has(w)).length;
    return fromClaude / words.length >= 0.6;
  }, []);

  const onInterimTranscript = useCallback(
    (text: string) => {
      if (!speakingRef.current && statusRef.current !== "paused") return;
      if (!ADDRESS.test(text.toLowerCase()) || isLikelyEcho(text)) return;
      tryInterrupt(stripAddress(text), 4, false);
    },
    [tryInterrupt, isLikelyEcho]
  );

  const onFinalTranscript = useCallback(
    (text: string) => {
      const t = text.toLowerCase();

      // ---- While Claude is speaking or paused ----
      // Only a request ADDRESSED to him acts (this also filters his own TTS
      // echoed back into the mic — the echo never contains "Claude").
      if (speakingRef.current || statusRef.current === "paused") {
        if (!ADDRESS.test(t) || isLikelyEcho(text)) return;
        const cmd = stripAddress(text);
        // "Claude, pause/stop/continue" → handle playback immediately.
        if (tryInterrupt(cmd, 8, true)) return;
        if (statusRef.current === "paused") return;
        // "Claude, <new request>" → silence him AT ONCE so he's not talking over
        // them, but don't answer until they've finished the whole sentence.
        stopPlayback();
        queueUserSpeech(cmd);
        return;
      }

      const s = statusRef.current;

      // ---- Confirming a navigation offer: accept a bare yes/no (no address) ----
      if (s === "confirming") {
        setHeard(text.trim());
        if (TURN_OFF.test(t) || GOODBYE.test(t)) {
          pendingRef.current = null;
          handleCommand(text);
          return;
        }
        const affirmative =
          /\b(yes|yeah|yep|yup|sure|okay|ok|go ahead|do it|please do|take me|sounds good)\b/.test(t) &&
          !/\b(no|not|don'?t|but|instead|actually|wait|rather|hold on)\b/.test(t);
        const target = pendingRef.current;
        pendingRef.current = null;
        if (affirmative && target) {
          navigateTo(target.href, target.query);
        } else {
          handleCommand(stripAddress(text) || text);
        }
        return;
      }

      // ---- Continuation of an in-progress command (the buffer window is open) ----
      // The rest of the same sentence needs no re-addressing.
      if (flushTimerRef.current) {
        queueUserSpeech(stripAddress(text));
        return;
      }

      // ---- A NEW command must be addressed to "Claude" ----
      // Anything not addressed is ambient talk and is ignored — so it no longer
      // reacts to every passing remark.
      if (!ADDRESS.test(t)) return;
      keepSessionAlive();
      setS("listening");
      queueUserSpeech(stripAddress(text));
    },
    [
      handleCommand,
      navigateTo,
      setS,
      keepSessionAlive,
      tryInterrupt,
      stopPlayback,
      queueUserSpeech,
      isLikelyEcho,
    ]
  );

  const enable = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || !isSpeechSupported()) {
      setS("unsupported");
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    // Interim results let us react to "stop"/"pause"/"continue" the instant
    // they're recognized, instead of waiting for a final transcript that may
    // never settle while TTS audio fills the mic.
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onFinalTranscript(r[0].transcript);
        else onInterimTranscript(r[0].transcript);
      }
    };
    rec.onend = () => {
      // Always keep the mic cycling while enabled — including during speech, so
      // the visitor can barge in with "stop".
      if (enabledRef.current) {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };
    rec.onerror = (err) => {
      if (err.error === "not-allowed" || err.error === "service-not-allowed") {
        enabledRef.current = false;
        setS("unsupported");
      }
    };
    recRef.current = rec;
    enabledRef.current = true;
    document.cookie = "rphope_voice=1; path=/; max-age=31536000; samesite=lax";
    try {
      rec.start();
    } catch {
      /* ignore */
    }
    say(INTRO, { after: () => setS("idle") });
  }, [onFinalTranscript, onInterimTranscript, say, setS]);

  useEffect(() => {
    if (!getRecognitionCtor() || !isSpeechSupported()) setS("unsupported");
  }, [setS]);

  useEffect(() => {
    return () => {
      enabledRef.current = false;
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      cancelSpeech();
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return {
    status,
    heard,
    message,
    enable,
    disable: teardown,
    pause: pausePlayback,
    resume: resumePlayback,
    stop: stopPlayback,
  };
}
