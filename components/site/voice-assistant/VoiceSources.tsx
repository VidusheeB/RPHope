"use client";

import Link from "next/link";
import type { Source } from "@/hooks/useRPVoiceAssistant";

// Source links backing the assistant's factual answers. Internal links use the
// router; external (http) links open in a new tab with a clear label.
export default function VoiceSources({ sources }: { sources: Source[] }) {
  if (sources.length === 0) return null;
  return (
    <div>
      <h3 className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink/60">
        Sources on RP Hope
      </h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {sources.slice(0, 4).map((s, i) => {
          const external = /^https?:\/\//.test(s.url);
          const label = s.heading ? `${s.title} — ${s.heading}` : s.title;
          return (
            <li key={`${s.url}-${i}`} className="text-sm">
              {external ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-forest underline hover:text-forest-dark"
                >
                  {label}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <Link
                  href={s.url}
                  className="font-semibold text-forest underline hover:text-forest-dark"
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
