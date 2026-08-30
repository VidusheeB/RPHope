"use client";

import { useEffect, useRef } from "react";
import type { TranscriptTurn } from "@/lib/voice/transcript";

// Live captions + full transcript. The most recent assistant line is mirrored in
// an aria-live region so screen readers hear it; the scrolling list is the full
// record. Text is always rendered as plain React text nodes (no raw HTML).
export default function VoiceTranscript({
  transcript,
  captions,
}: {
  transcript: TranscriptTurn[];
  captions: boolean;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [transcript]);

  const latestAssistant = [...transcript].reverse().find((t) => t.role === "assistant");

  return (
    <div className="flex flex-col gap-2">
      {/* Live caption for screen readers (and sighted users, if enabled). */}
      <div aria-live="polite" className={captions ? "sr-only" : "sr-only"}>
        {latestAssistant ? `Hope: ${latestAssistant.text}` : ""}
      </div>

      <div
        className="max-h-60 overflow-y-auto rounded-md border border-ink/12 bg-cream/60 p-3"
        role="log"
        aria-label="Conversation transcript"
      >
        {transcript.length === 0 ? (
          <p className="text-sm text-ink/60">
            Your conversation will appear here as captions.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {transcript.map((t) => (
              <li key={t.id} className="text-sm">
                <span
                  className={`mb-0.5 block text-[0.7rem] font-bold uppercase tracking-[0.12em] ${
                    t.role === "assistant" ? "text-forest" : "text-ink/60"
                  }`}
                >
                  {t.role === "assistant" ? "Hope" : t.role === "user" ? "You" : "System"}
                </span>
                <span className="text-ink/90">
                  {t.text}
                  {t.inProgress ? " …" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
