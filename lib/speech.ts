// Text-to-speech for the "Listen to this page" button. OpenAI only
// (`/api/tts`, gpt-4o-mini-tts) — no browser Web Speech fallback. The button
// itself gates on `isTTSAvailable()` (a server-configured check), not on any
// browser speech feature, since playback is just an <audio> element.

export function isTTSAvailable(): Promise<boolean> {
  return fetch("/api/tts")
    .then((res) => res.json())
    .then((json) => Boolean(json?.available))
    .catch(() => false);
}

type SpeakOpts = {
  rate?: number;
  onEnd?: () => void;
  onError?: () => void;
  voice?: string;
  instructions?: string;
};

// Generation token: every speak()/cancel() bumps it so a stale request chain
// (or one cancelled mid-flight) can't keep playing.
let speakToken = 0;
let paused = false;
let audioEl: HTMLAudioElement | null = null;

function getAudioEl(): HTMLAudioElement {
  if (!audioEl) audioEl = new Audio();
  return audioEl;
}

export function cancelSpeech(): void {
  speakToken++;
  paused = false;
  if (audioEl) {
    audioEl.pause();
    audioEl.removeAttribute("src");
    try {
      audioEl.load();
    } catch {
      /* no-op */
    }
  }
}

/** Pause the current read-aloud; it can be resumed where it left off. */
export function pauseSpeech(): void {
  if (audioEl && !audioEl.paused) {
    audioEl.pause();
    paused = true;
  }
}

/** Resume a paused read-aloud. */
export function resumeSpeech(): void {
  paused = false;
  if (audioEl) {
    audioEl.play().catch(() => {
      /* ignore */
    });
  }
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

// Split long text into short, sentence-aligned chunks so each OpenAI request
// stays small (faster first audio, and under the API's per-request cap).
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
 * Speak `text` via OpenAI TTS. Cancels anything currently playing first.
 * `onEnd` fires once when finished (not on cancel/supersede — callers that
 * cancel restore their own state). `onError` fires if a request fails.
 */
export function speak(text: string, opts: SpeakOpts = {}): void {
  if (!text.trim()) {
    opts.onEnd?.();
    return;
  }
  cancelSpeech(); // stops current playback and bumps speakToken
  const myToken = speakToken;
  void speakOpenAI(text, opts, myToken);
}

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
      if (myToken === speakToken) opts.onError?.();
      return;
    }

    if (myToken !== speakToken) {
      URL.revokeObjectURL(url);
      return;
    }
    await playUrl(el, url, opts.rate);
    URL.revokeObjectURL(url);
  }

  if (myToken === speakToken) opts.onEnd?.();
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
