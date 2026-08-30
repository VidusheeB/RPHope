// Fallback detection of "I'm done" from a COMPLETED user transcript.
//
// The primary path is Hope calling the end_voice_session tool. This exists
// because a model can miss the intent, and a user who has said "stop
// listening" must not be left with a live microphone. endSession() is
// idempotent, so both paths firing is harmless.

const EXIT_PATTERNS: RegExp[] = [
  /\bbye\b/,
  /\bbye[-\s]?bye\b/,
  /\bgoodbye\b/,
  /\bstop listening\b/,
  /\bend (the |this )?(conversation|session|chat)\b/,
  /\b(i'?m|i am) (all )?done\b/,
  /\bthat'?s all\b/,
  /\bthat is all\b/,
];

// Phrases that CONTAIN an exit word but plainly are not a request to end.
// Without these, "I'm done with this page, what's next?" would hang up on
// someone mid-conversation.
const NEGATIVE_PATTERNS: RegExp[] = [
  /\b(don'?t|do not|didn'?t|never) (say |want )?(good)?bye\b/,
  /\bnot done\b/,
  /\bdone with (this|that|the) (page|section|gene|question|part)\b/,
  /\bbefore (you |we )?(go|end|stop)\b/,
  /\bwhat does .{0,40}\bbye\b/,
];

/** True when a completed user transcript is a clear request to end. */
export function isExitPhrase(transcript: string): boolean {
  const text = transcript.toLowerCase().replace(/\s+/g, " ").trim();
  if (!text) return false;
  if (NEGATIVE_PATTERNS.some((re) => re.test(text))) return false;
  return EXIT_PATTERNS.some((re) => re.test(text));
}
