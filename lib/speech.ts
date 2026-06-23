// Thin wrapper over the browser-native Web Speech API SpeechSynthesis.
// Free, client-side, no API keys (per CLAUDE.md: never paid TTS on day one).
// Shared by the read-aloud button and the voice assistant.

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Generation token: every speak()/cancel() bumps it so a stale utterance chain
// (or one cancelled mid-flight) can't keep talking. Chrome fires onend even on
// cancel(), which would otherwise advance our queue — this guards against that.
let speakToken = 0;
let keepAlive: ReturnType<typeof setInterval> | undefined;
let paused = false; // when true, the keep-alive must NOT auto-resume

function stopKeepAlive() {
  if (keepAlive) {
    clearInterval(keepAlive);
    keepAlive = undefined;
  }
}

export function cancelSpeech(): void {
  speakToken++;
  paused = false;
  stopKeepAlive();
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}

/** Pause the current read-aloud; it can be resumed where it left off. */
export function pauseSpeech(): void {
  if (isSpeechSupported() && window.speechSynthesis.speaking) {
    paused = true;
    window.speechSynthesis.pause();
  }
}

/** Resume a paused read-aloud. */
export function resumeSpeech(): void {
  if (isSpeechSupported()) {
    paused = false;
    window.speechSynthesis.resume();
  }
}

// Split long text into short, sentence-aligned chunks. Chrome silently stops
// speaking after ~15s on a single long utterance, so we keep each chunk small
// and queue them — the real fix for the "it froze" bug.
function chunkText(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [text];
  const chunks: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && (cur + s).length > 200) {
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
 * Speak `text`, cancelling anything currently playing. Long text is chunked and
 * queued so it never trips Chrome's long-utterance freeze. `onEnd` fires once,
 * when the whole thing finishes (or on cancel/supersede it simply won't fire —
 * callers that cancel must restore their own state).
 */
export function speak(
  text: string,
  opts: { rate?: number; onEnd?: () => void } = {}
): void {
  if (!isSpeechSupported() || !text.trim()) {
    opts.onEnd?.();
    return;
  }
  const myToken = ++speakToken;
  paused = false;
  window.speechSynthesis.cancel();

  const chunks = chunkText(text);
  let i = 0;

  // Periodic resume() works around Chrome pausing the queue after ~15s — but NOT
  // when the visitor deliberately paused (don't fight an intentional pause).
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
      opts.onEnd?.();
      return;
    }
    const u = new SpeechSynthesisUtterance(chunks[i++]);
    u.rate = opts.rate ?? 1;
    u.onend = speakNext;
    u.onerror = speakNext; // skip a bad chunk rather than stall the whole read
    window.speechSynthesis.speak(u);
  };
  speakNext();
}
