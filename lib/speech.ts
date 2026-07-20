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
// Acronyms that should read as letters but WITHOUT the trailing full stop the
// gene-symbol treatment adds — that period creates an awkward pause (e.g. the
// brand "RP Hope" must not become "R. P. [pause] Hope").
const SPELL_KEEP: Record<string, string> = {
  RP: "R P",
};

function spellOutSymbols(text: string): string {
  return text.replace(/\b[0-9]*[A-Z][A-Z0-9]*\b/g, (tok) => {
    if (tok.length < 2) return tok;
    if (SPELL_KEEP[tok]) return SPELL_KEEP[tok];
    return tok.split("").join(". ") + ".";
  });
}

// Split long text into short, sentence-aligned chunks so each OpenAI request
// stays small (faster synthesis, and under the API's per-request cap).
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

// Deliberately asymmetric chunking: the FIRST chunk is kept short so its
// synthesis finishes fast (time-to-first-audio is what the listener feels as
// "does this start immediately?"); the REST are chunked larger to keep the
// total request count — and cost — down, since later chunks' fetches happen
// in the background while the previous chunk is still playing (see the
// pipeline in speakOpenAI) and their latency is never on the critical path.
//
// OpenAI's TTS latency scales with output length, not a fixed per-request
// floor (measured: ~4 chars ≈1.6s, ~80 chars ≈3s, ~400 chars ≈4s, ~1900
// chars ≈14s) — so keeping the first chunk small genuinely matters here.
const FIRST_CHUNK_MAX = 100;
const REST_CHUNK_MAX = 700;
function chunkForSpeech(text: string): string[] {
  const short = chunkText(text, FIRST_CHUNK_MAX);
  if (short.length <= 1) return short;
  const [first, ...rest] = short;
  return [first, ...chunkText(rest.join(" "), REST_CHUNK_MAX)];
}

type FetchOpts = Pick<SpeakOpts, "voice" | "instructions">;

async function fetchChunkAudio(chunk: string, opts: FetchOpts): Promise<string | null> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: chunk, voice: opts.voice, instructions: opts.instructions }),
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

function chunkKey(chunk: string, opts: FetchOpts): string {
  return `${chunk}|${opts.voice ?? ""}|${opts.instructions ?? ""}`;
}

// ---- Hover/focus prefetch ----
// Start generating the first chunk's audio as soon as intent is likely (mouse
// hover / keyboard focus on the button), well before the actual click. Never
// plays anything (WCAG 1.4.2 — playback only starts on the real click); it
// just moves the one unavoidable network+synthesis wait earlier so the click
// itself is instant more often than not.
let prefetchKeyValue: string | null = null;
let prefetchPromise: Promise<string | null> | null = null;

export function prefetchSpeech(text: string, opts: FetchOpts = {}): void {
  if (!text.trim()) return;
  const chunks = chunkForSpeech(spellOutSymbols(text));
  if (!chunks.length) return;
  const key = chunkKey(chunks[0], opts);
  if (prefetchKeyValue === key) return; // already prefetching/prefetched this
  const stale = prefetchPromise;
  if (stale) stale.then((u) => u && URL.revokeObjectURL(u));
  prefetchKeyValue = key;
  prefetchPromise = fetchChunkAudio(chunks[0], opts);
}

/** Discard any pending/unused prefetch (e.g. on unmount) so its blob URL isn't leaked. */
export function cancelPrefetch(): void {
  const stale = prefetchPromise;
  prefetchKeyValue = null;
  prefetchPromise = null;
  if (stale) stale.then((u) => u && URL.revokeObjectURL(u));
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

// Fetches the NEXT chunk while the CURRENT one plays, so — apart from the
// very first chunk — there is no gap between sentences waiting on synthesis.
async function speakOpenAI(
  text: string,
  opts: SpeakOpts,
  myToken: number
): Promise<void> {
  const chunks = chunkForSpeech(spellOutSymbols(text));
  if (!chunks.length) {
    if (myToken === speakToken) opts.onEnd?.();
    return;
  }
  const el = getAudioEl();

  // Reuse a matching hover/focus prefetch for the first chunk if we have one.
  const firstKey = chunkKey(chunks[0], opts);
  let nextPromise: Promise<string | null>;
  if (prefetchKeyValue === firstKey && prefetchPromise) {
    nextPromise = prefetchPromise;
    prefetchKeyValue = null;
    prefetchPromise = null;
  } else {
    nextPromise = fetchChunkAudio(chunks[0], opts);
  }

  for (let i = 0; i < chunks.length; i++) {
    if (myToken !== speakToken) return;
    const url = await nextPromise;
    if (myToken !== speakToken) {
      if (url) URL.revokeObjectURL(url);
      return;
    }
    if (!url) {
      opts.onError?.();
      return;
    }
    // Kick off the next chunk's synthesis now, while this one plays.
    nextPromise =
      i + 1 < chunks.length ? fetchChunkAudio(chunks[i + 1], opts) : Promise.resolve(null);

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
