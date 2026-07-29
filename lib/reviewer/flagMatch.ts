// Best-effort link from an AI review flag's free text to the specific
// sentence(s) it most plausibly concerns. Flags are still a flat string
// array with no stored section/sentence reference (see CLAUDE.md's Phase 7
// note), so this is a lightweight keyword-overlap heuristic rather than a
// stored link — good enough to jump a reviewer to the right neighborhood
// and let them confirm, without a pipeline/schema change.

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "is",
  "are", "was", "were", "be", "been", "this", "that", "these", "those", "it",
  "its", "as", "at", "by", "with", "from", "not", "no", "may", "might",
  "should", "could", "would", "has", "have", "had", "than", "then", "which",
  "who", "whom", "there", "here", "into", "about", "if", "so", "such",
]);

function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
  );
}

export type SentenceLocation = { sectionKey: string; sentenceIndex: number };

/** Find the sentence (across all given sections) whose text shares the most
 *  significant words with the flag text. Returns null when nothing scores
 *  above zero (no plausible match) rather than guessing randomly. */
export function findBestMatchingSentence(
  flagText: string,
  sections: { sectionKey: string; sentences: { text: string }[] }[]
): SentenceLocation | null {
  const flagWords = significantWords(flagText);
  if (flagWords.size === 0) return null;

  let best: SentenceLocation | null = null;
  let bestScore = 0;

  for (const section of sections) {
    section.sentences.forEach((sentence, sentenceIndex) => {
      const sentenceWords = significantWords(sentence.text);
      let score = 0;
      sentenceWords.forEach((w) => {
        if (flagWords.has(w)) score++;
      });
      if (score > bestScore) {
        bestScore = score;
        best = { sectionKey: section.sectionKey, sentenceIndex };
      }
    });
  }

  return best;
}
