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

const WAKE =
  /\b(hello|hey|hi|ok|okay)\s+(claude|cloud|clod|claud|clawed|cloud's|clyde|claudia)\b/;
const INTRO =
  "Say, Hello Claude, to start. Then just talk naturally — I'll keep listening until you say, turn off. You can also say, stop, to interrupt me, or, pause, and, continue.";

const TURN_OFF =
  /\bturn (it |the (voice|mic|assistant) )?off\b|\bturn off\b|\bshut (it |down|off)\b|\bdisable\b|\bclose (the )?(voice|mic|assistant)\b/;
const GOODBYE =
  /\b(goodbye|good bye|bye|that's all|that is all|i'?m done|go to sleep|never mind|stop listening)\b/;

// Advice-seeking ("what should we do", "is there a cure"). We never refuse or
// dead-end (CLAUDE.md: "navigate, don't triage"): we read the REVIEWED options
// verbatim, then hand the actual decision to a clinician. We never tell a
// specific person what to do.
const ADVICE =
  /\bwhat should (i|we|they|my|he|she)\b|\bwhat (can|do|should) (i|we)\b|\bhow (do|can|should) (i|we) (treat|stop|slow|cure|manage|help|deal|fix)\b|\bis there (a cure|anything|any treatment|any way|something)\b|\bbest (treatment|option|course|thing|approach)\b|\bwhat are (my|our|the) options\b|\bwhat do (i|we) do\b/;

const PROVIDER_HANDOFF =
  "These are general options from the reviewed studies, not advice for your situation. Your healthcare provider or a genetic counselor can tell you the best course of action for you.";


// ---------------------------------------------------------------------------
// Section extraction. We read VERBATIM page content — the AI only decides which
// section to read, never what it says. Sections come from explicit
// data-readable hooks, definition lists (at-a-glance fields), and headings.
// ---------------------------------------------------------------------------
type Section = { key: string; text: string };

// Synonyms map a fuzzy question to a section's label so "how rare is it",
// "who's the face", "any trials" land on the right verbatim block.
const SECTION_SYNONYMS: Record<string, string[]> = {
  "face of rp": ["face", "person", "who is", "whose", "patient story", "behind", "story of"],
  "treatment options": ["treatment", "therapy", "cure", "drug", "medication", "treat", "fix"],
  "patient population": ["population", "how rare", "how common", "how many", "prevalence", "people affected", "rare"],
  "strategies to preserve eye health": ["eye health", "preserve", "protect", "strateg", "supplement", "vitamin", "lutein", "diet", "slow"],
  "clinical trials": ["trial", "trials", "recruiting", "enroll", "join a study", "join study"],
  "institution(s) conducting research": ["institution", "universit", "lab", "researching", "who is studying", "research center", "conducting", "who studies"],
  "disease category": ["category", "inheritance", "recessive", "dominant", "x-linked", "x linked", "inherit"],
  "brief description": ["describe", "description", "what is", "tell me about", "summary", "overview", "explain", "more about", "what does"],
  "in the news": ["news", "article", "studies", "recent", "latest", "what's new", "research that matters"],
};

function getSections(): Section[] {
  const main = typeof document !== "undefined" ? document.getElementById("main") : null;
  if (!main) return [];
  const out: Section[] = [];

  main.querySelectorAll<HTMLElement>("[data-readable-key]").forEach((el) => {
    const key = el.dataset.readableKey?.trim();
    const text = el.dataset.readableText?.trim() || el.innerText.trim();
    if (key && text) out.push({ key, text });
  });

  main.querySelectorAll("dt").forEach((dt) => {
    const label = dt.textContent?.trim() ?? "";
    const dd = dt.nextElementSibling as HTMLElement | null;
    const value = dd?.textContent?.trim() ?? "";
    if (label && value) out.push({ key: label, text: `${label}. ${value}.` });
  });

  main.querySelectorAll("h2, h3").forEach((h) => {
    const key = h.textContent?.trim() ?? "";
    if (!key) return;
    let text = `${key}. `;
    let n = h.nextElementSibling as HTMLElement | null;
    while (n && !/^H[1-3]$/.test(n.tagName)) {
      text += `${n.innerText} `;
      n = n.nextElementSibling as HTMLElement | null;
    }
    out.push({ key, text: text.trim() });
  });

  return out;
}

// Pick the section whose label/synonyms best overlap the question. Returns null
// when nothing clearly matches (caller falls back to the brief description).
function pickSection(query: string, sections: Section[]): Section | null {
  const q = query.toLowerCase();
  let best: Section | null = null;
  let bestScore = 0;
  for (const s of sections) {
    const keyL = s.key.toLowerCase();
    let score = 0;
    if (q.includes(keyL)) score += 3;
    const syns = SECTION_SYNONYMS[keyL];
    if (syns) for (const term of syns) if (q.includes(term)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return bestScore > 0 ? best : null;
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

  // Read the section that answers `query`, or the brief description, or the
  // whole page. All content is verbatim from the reviewed page; only the
  // advice-handoff framing is fixed wording.
  const readRelevant = useCallback(
    (query: string | null) => {
      const sections = getSections();

      // "What should we do?" → reviewed options + clinician handoff, never refuse.
      if (query && ADVICE.test(query.toLowerCase())) {
        const wanted = new Set([
          "treatment options",
          "strategies to preserve eye health",
          "clinical trials",
        ]);
        const picked = sections.filter((s) => wanted.has(s.key.toLowerCase()) && s.text);
        if (picked.length) {
          readText(
            `Here's what the reviewed information on this page says. ${picked
              .map((s) => s.text)
              .join(" ")} ${PROVIDER_HANDOFF}`,
            "Reviewed options + ask your provider"
          );
        } else {
          readText(
            `I can point you to information on this. ${PROVIDER_HANDOFF}`,
            "Ask your provider"
          );
        }
        return;
      }

      if (query) {
        const sec = pickSection(query, sections);
        if (sec) {
          readText(sec.text, `Reading: ${sec.key}`);
          return;
        }
      }
      const brief = sections.find((s) => /brief description|description/i.test(s.key));
      readText(brief ? brief.text : mainText());
    },
    [readText, mainText]
  );

  const readCurrentPage = useCallback(() => {
    readText(mainText(), "Reading this page aloud… (say “stop” to stop)");
  }, [readText, mainText]);

  // After a client-side navigation the new page isn't in <main> yet. Poll until
  // the content actually changes, THEN read the relevant section — fixes reading
  // the page you just left. Gives up after ~5s.
  const readAfterNavigation = useCallback(
    (prevText: string, query: string | null) => {
      let attempts = 0;
      const tick = () => {
        const now = mainText();
        if ((now.length > 40 && now !== prevText) || attempts >= 16) {
          readRelevant(query);
          return;
        }
        attempts += 1;
        setTimeout(tick, 300);
      };
      setTimeout(tick, 300);
    },
    [mainText, readRelevant]
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
        readAfterNavigation(prev, readQuery);
      } else {
        say("Here you go. Just tell me what's next.");
      }
    },
    [router, say, mainText, readAfterNavigation, keepSessionAlive, setS]
  );

  const teardown = useCallback(() => {
    enabledRef.current = false;
    sessionRef.current = false;
    if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
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
        cancelSpeech();
        speakingRef.current = false;
        say("Okay. Say Hello Claude when you need me.", { after: () => setS("idle") });
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
        readAfterNavigation(prev, null);
        return;
      }
      if (/\bread (this|the|it|page|aloud)\b|\bread it\b|\bread the page\b/.test(t) || t === "read") {
        readCurrentPage();
        return;
      }
      // Explicit "go somewhere" intent → bounded navigation.
      if (/\b(take me|bring me|go to|open|show me|navigate to|pull up|jump to|visit|head to)\b/.test(t)) {
        void navigateByQuery(raw);
        return;
      }
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
      readAfterNavigation,
      readCurrentPage,
      navigateByQuery,
      converse,
    ]
  );

  const onFinalTranscript = useCallback(
    (text: string) => {
      const t = text.toLowerCase();

      // BARGE-IN: while Claude is speaking the mic is still on, so it may hear
      // (a) the visitor interrupting, or (b) its own TTS echoed back. We only
      // ACT on a SHORT utterance that contains an interrupt word — that's a real
      // interruption; long transcripts are almost always Claude hearing itself.
      if (speakingRef.current) {
        const words = t.trim().split(/\s+/).length;
        if (words > 8) return; // long transcript → Claude hearing itself; ignore

        const isResume = /\b(continue|resume|keep going|carry on|go on|unpause|keep talking)\b/.test(t);
        const isPause = !isResume && /\b(pause|hold on|hang on|one moment|one second)\b/.test(t) && !/\bstop\b/.test(t);
        const isStop = /\b(stop|quiet|shush|enough|cancel|never mind|shut up|hey claude|hello claude|hi claude|okay stop)\b/.test(t);

        // RESUME a paused answer where it left off — no reset.
        if (statusRef.current === "paused") {
          if (isResume) {
            setHeard(text.trim());
            resumeSpeech();
            setS("speaking");
          } else if (isStop) {
            setHeard(text.trim());
            cancelSpeech();
            speakingRef.current = false;
            setMessage("");
            setS("listening");
          }
          return; // ignore anything else while paused
        }

        // PAUSE (hold the answer, keep it ready to resume).
        if (isPause) {
          setHeard(text.trim());
          pauseSpeech();
          setS("paused");
          setMessage("Paused — say “continue” to resume.");
          return;
        }

        if (!isStop) return; // not an interrupt → ignore (echo/background)

        // STOP — cancel the answer.
        setHeard(text.trim());
        cancelSpeech();
        speakingRef.current = false;
        setMessage("");
        setS("listening");
        keepSessionAlive();
        // "stop, tell me about X" → also run the remainder as a fresh command.
        const rest = text
          .replace(/^.*?\b(stop|quiet|shush|enough|cancel|never mind|shut up|claude)\b[\s,.!]*/i, "")
          .trim();
        if (rest.length > 3) handleCommand(rest);
        return;
      }
      setHeard(text.trim());

      const s = statusRef.current;

      if (s === "confirming") {
        // Turn-off / goodbye take priority (so "no, turn off" still turns off).
        if (TURN_OFF.test(t) || GOODBYE.test(t)) {
          pendingRef.current = null;
          handleCommand(text);
          return;
        }
        // ONLY a clean affirmative navigates. "no", "no but tell me about X",
        // "yes but actually…", or any new question all flow back into the
        // natural conversation — Claude already has the offer in its history.
        const affirmative =
          /\b(yes|yeah|yep|yup|sure|okay|ok|go ahead|do it|please do|take me|sounds good)\b/.test(t) &&
          !/\b(no|not|don'?t|but|instead|actually|wait|rather|hold on)\b/.test(t);
        const target = pendingRef.current;
        pendingRef.current = null;
        if (affirmative && target) {
          navigateTo(target.href, target.query);
        } else {
          handleCommand(text); // → converse(), keeps the thread going
        }
        return;
      }

      if (sessionRef.current || s === "listening") {
        handleCommand(text);
        return;
      }

      if (WAKE.test(t)) {
        keepSessionAlive();
        const after = text.replace(new RegExp(WAKE, "i"), "").trim();
        if (after.length > 2) {
          setS("listening");
          handleCommand(after);
        } else {
          setS("listening");
          say("I'm listening.", { after: () => setS("listening") });
        }
      }
    },
    [handleCommand, navigateTo, say, setS, keepSessionAlive]
  );

  const enable = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || !isSpeechSupported()) {
      setS("unsupported");
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onFinalTranscript(r[0].transcript);
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
  }, [onFinalTranscript, say, setS]);

  useEffect(() => {
    if (!getRecognitionCtor() || !isSpeechSupported()) setS("unsupported");
  }, [setS]);

  useEffect(() => {
    return () => {
      enabledRef.current = false;
      if (sessionTimerRef.current) clearTimeout(sessionTimerRef.current);
      cancelSpeech();
      try {
        recRef.current?.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { status, heard, message, enable, disable: teardown };
}
