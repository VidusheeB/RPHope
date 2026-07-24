import type { ReactNode } from "react";
import GlossaryTerm from "@/components/site/GlossaryTerm";
import { GLOSSARY } from "./glossary";

// Flatten term + aliases into one matchable list, longest string first, so a
// multi-word term is never shadowed by matching only part of it.
const ENTRIES = GLOSSARY.flatMap((e) =>
  [e.term, ...(e.aliases ?? [])].map((match) => ({ term: e.term, definition: e.definition, match }))
).sort((a, b) => b.match.length - a.match.length);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const PATTERN = ENTRIES.length
  ? new RegExp(`\\b(${ENTRIES.map((e) => escapeRegExp(e.match)).join("|")})\\b`, "gi")
  : null;

/**
 * Renders `text` as plain strings interspersed with <GlossaryTerm> wrappers
 * around any recognized jargon word/phrase. Only the FIRST occurrence of
 * each distinct term within THIS call is wrapped — repeats later in the
 * same paragraph render as plain text, so a dense block of prose doesn't
 * end up with the same dotted underline repeated three times in a row.
 * (Scoped per call, not per page — a term can still be glossed again in a
 * later section, which is fine since a reader may jump straight there.)
 */
export function renderWithGlossary(text: string): ReactNode {
  if (!PATTERN) return text;
  const seen = new Set<string>();
  const parts = text.split(PATTERN);
  return parts.map((part, i) => {
    const entry = ENTRIES.find((e) => e.match.toLowerCase() === part.toLowerCase());
    if (!entry || seen.has(entry.term.toLowerCase())) return part;
    seen.add(entry.term.toLowerCase());
    return (
      <GlossaryTerm key={i} term={entry.term} definition={entry.definition}>
        {part}
      </GlossaryTerm>
    );
  });
}
