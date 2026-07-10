// Text-to-speech, shared by the read-aloud button and the voice assistant.
//
// TWO engines behind ONE stable API (speak / cancelSpeech / pauseSpeech /
// resumeSpeech / isSpeechSupported):
//   - OpenAI (`/api/tts`, gpt-4o-mini-tts) — natural voice with inflection.
//     Used when a server OPENAI_API_KEY is present (probed once per session).
//   - Web Speech API (browser-native) — free, client-side fallback when OpenAI
//     isn't configured or a request fails. This preserves the original behavior.
//
// Callers don't know or care which engine ran. Note the mic *input* for the
// voice assistant is separate (webkitSpeechRecognition) and unaffected by this.

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

type SpeakOpts = {
  rate?: number;
  onEnd?: () => void;
  voice?: string;
  instructions?: string;
};

// Generation token: every speak()/cancel() bumps it so a stale utterance chain
// (or one cancelled mid-flight) can't keep talking — guards both engines.
let speakToken = 0;
let activeEngine: "openai" | "web" | null = null;

// ---- Web Speech state ----
let keepAlive: ReturnType<typeof setInterval> | undefined;
let paused = false; // when true, the keep-alive must NOT auto-resume

// ---- OpenAI state ----
let openaiAvailable: boolean | null = null; // probed once, then cached
let audioEl: HTMLAudioElement | null = null;

function stopKeepAlive() {
  if (keepAlive) {
    clearInterval(keepAlive);
    keepAlive = undefined;
  }
}

function getAudioEl(): HTMLAudioElement {
  if (!audioEl) audioEl = new Audio();
  return audioEl;
}

async function isOpenAIAvailable(): Promise<boolean> {
  if (openaiAvailable !== null) return openaiAvailable;
  try {
    const res = await fetch("/api/tts");
    const json = await res.json().catch(() => ({}));
    openaiAvailable = res.ok && json?.available === true;
  } catch {
    openaiAvailable = false;
  }
  return openaiAvailable;
}

export function cancelSpeech(): void {
  speakToken++;
  paused = false;
  stopKeepAlive();
  // Stop OpenAI audio
  if (audioEl) {
    audioEl.pause();
    audioEl.removeAttribute("src");
    try {
      audioEl.load();
    } catch {
      /* no-op */
    }
  }
  // Stop Web Speech
  if (isSpeechSupported()) window.speechSynthesis.cancel();
  activeEngine = null;
}

/** Pause the current read-aloud; it can be resumed where it left off. */
export function pauseSpeech(): void {
  if (activeEngine === "openai" && audioEl) {
    audioEl.pause();
    paused = true;
    return;
  }
  if (isSpeechSupported() && window.speechSynthesis.speaking) {
    paused = true;
    window.speechSynthesis.pause();
  }
}

/** Resume a paused read-aloud. */
export function resumeSpeech(): void {
  paused = false;
  if (activeEngine === "openai" && audioEl) {
    audioEl.play().catch(() => {
      /* ignore */
    });
    return;
  }
  if (isSpeechSupported()) window.speechSynthesis.resume();
}

// Gene symbols and acronyms (e.g. "USH3A", "INPP5E", "RPGR", "ADGRA3") must be
// read letter-by-letter, not pronounced as words ("ush-three-A"). We spell out
// any all-caps alphanumeric token of 2+ chars as an initialism — each character
// followed by a period ("A. D. G. R. A. 3.") — which voices read as letter
// names. Applied per-utterance. Mixed-case words and single letters are left
// alone. (Do NOT respell "A" as "ay" — voices read "ay" as "aye"/"I".)
function spellOutSymbols(text: string): string {
  return text.replace(/\b[0-9]*[A-Z][A-Z0-9]*\b/g, (tok) => {
    if (tok.length < 2) return tok;
    return tok.split("").join(". ") + ".";
  });
}

// Split long text into short, sentence-aligned chunks. Keeps each Web Speech
// utterance under Chrome's ~15s freeze, and keeps each OpenAI request small so
// the first audio starts sooner. `max` differs per engine.
function chunkText(text: string, max: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [text];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && (cur + s).length > max) {
      chunks.push(cur.trim());
      cur = s;
    } else {
      cur += s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

/**
 * Speak `text`. Chooses OpenAI when available, else the browser voice. Cancels
 * anything currently playing first. `onEnd` fires once when finished (not on
 * cancel/supersede — callers that cancel restore their own state).
 */
export function speak(text: string, opts: SpeakOpts = {}): void {
  if (!text.trim()) {
    opts.onEnd?.();
    return;
  }
  cancelSpeech(); // stops current playback and bumps speakToken
  const myToken = speakToken;

  void (async () => {
    const useOpenAI = await isOpenAIAvailable();
    if (myToken !== speakToken) return; // superseded during the probe
    if (useOpenAI) {
      activeEngine = "openai";
      void speakOpenAI(text, opts, myToken);
    } else {
      activeEngine = "web";
      speakWeb(text, opts, myToken);
    }
  })();
}

// ---- OpenAI engine ----
async function speakOpenAI(
  text: string,
  opts: SpeakOpts,
  myToken: number
): Promise<void> {
  const chunks = chunkText(spellOutSymbols(text), 700);
  const el = getAudioEl();

  for (const chunk of chunks) {
    if (myToken !== speakToken) return;
    let url: string;
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: chunk,
          voice: opts.voice,
          instructions: opts.instructions,
        }),
      });
      if (!res.ok) throw new Error(`tts ${res.status}`);
      const blob = await res.blob();
      url = URL.createObjectURL(blob);
    } catch {
      // A chunk failed mid-read — fall back to the browser voice for the REST
      // so the user still hears the remaining content.
      if (myToken === speakToken) {
        openaiAvailable = false; // don't keep retrying OpenAI this session
        activeEngine = "web";
        const remaining = chunks.slice(chunks.indexOf(chunk)).join(" ");
        speakWeb(remaining, opts, myToken);
      }
      return;
    }

    if (myToken !== speakToken) {
      URL.revokeObjectURL(url);
      return;
    }
    await playUrl(el, url, opts.rate);
    URL.revokeObjectURL(url);
  }

  if (myToken === speakToken) {
    activeEngine = null;
    opts.onEnd?.();
  }
}

function playUrl(
  el: HTMLAudioElement,
  url: string,
  rate?: number
): Promise<void> {
  return new Promise((resolve) => {
    el.src = url;
    el.playbackRate = rate ?? 1;
    el.onended = () => resolve();
    el.onerror = () => resolve();
    el.play().catch(() => resolve());
  });
}

// ---- Web Speech engine (fallback; original behavior) ----
function speakWeb(text: string, opts: SpeakOpts, myToken: number): void {
  if (!isSpeechSupported() || !text.trim()) {
    if (myToken === speakToken) opts.onEnd?.();
    return;
  }
  paused = false;
  window.speechSynthesis.cancel();

  const chunks = chunkText(text, 200);
  let i = 0;

  stopKeepAlive();
  keepAlive = setInterval(() => {
    if (myToken !== speakToken) {
      stopKeepAlive();
      return;
    }
    if (!paused && window.speechSynthesis.speaking) window.speechSynthesis.resume();
  }, 5000);

  const speakNext = () => {
    if (myToken !== speakToken) return; // cancelled or superseded
    if (i >= chunks.length) {
      stopKeepAlive();
      activeEngine = null;
      opts.onEnd?.();
      return;
    }
    const u = new SpeechSynthesisUtterance(spellOutSymbols(chunks[i++]));
    u.rate = opts.rate ?? 1;
    u.onend = speakNext;
    u.onerror = speakNext; // skip a bad chunk rather than stall the whole read
    window.speechSynthesis.speak(u);
  };
  speakNext();
}
