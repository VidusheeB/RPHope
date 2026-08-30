// Automated prose-quality warnings for generated gene pages.
//
// These FLAG a draft for human review. Nothing here edits or deletes content:
// the review that prompted this work found the drafts substantively good but
// repetitive, and "make it shorter" is exactly the instruction that would have
// cost real medical detail. So every check produces a warning a reviewer reads,
// never an automatic trim.
//
// What it looks for, from the review's findings:
//   - main prose outside the 900-1,100 word target (CLRN1 ran to ~1,860);
//   - the same point restated across sections (FSCN2 said "disputed" in nearly
//     every section; ADIPOR1 repeated "evidence is limited");
//   - the treatment-status disclaimer repeated in summary + research + trial +
//     caregiver sections;
//   - unusually dense sentences (several ideas welded into one);
//   - missing required sections.

export type QualityWarning = {
  code:
    | "word_count_low"
    | "word_count_high"
    | "repeated_claim"
    | "repeated_disclaimer"
    | "dense_sentences"
    | "missing_section";
  message: string;
  /** Sections the warning refers to, when applicable. */
  sections?: string[];
};

/** Sections whose prose counts as "main gene-specific prose". Research cards
 *  and clinician questions are deliberately EXCLUDED — they are reference
 *  material in expandable UI, not the page's reading load. */
export const MAIN_PROSE_SECTIONS = [
  "summaryCard",
  "whatThisGeneMeans",
  "howItMayAffectVision",
  "whatIsKnown",
  "whatIsUncertain",
  "whatYouCanDoNext",
  "forFamilyAndCaregivers",
  "treatmentAndResearch",
  "clinicalTrialSummary",
] as const;

export const REQUIRED_SECTIONS = MAIN_PROSE_SECTIONS;

export const WORD_TARGET_MIN = 900;
export const WORD_TARGET_MAX = 1100;
/** Only warn beyond a margin, so a page at 1,150 isn't nagged about. */
export const WORD_TOLERANCE = 120;

/** A sentence carrying this many words is likely welding several ideas
 *  together — the "Claude-style density" the review described. */
export const DENSE_SENTENCE_WORDS = 45;
/** Warn when this share of sentences are dense. */
export const DENSE_SENTENCE_RATIO = 0.15;

/** A section's prose, however the draft represents it. */
export type SectionText = { section: string; text: string };

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Content words, for comparing what two sentences actually assert. */
const STOPWORDS = new Set([
  "the","a","an","of","in","on","for","and","or","to","with","by","from","as",
  "at","is","are","was","were","be","been","its","it","this","that","these",
  "those","may","can","not","but","has","have","had","which","when","who",
  "there","their","they","them","some","people","also","than","such","other",
]);

function contentWords(sentence: string): Set<string> {
  return new Set(
    sentence
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOPWORDS.has(w))
  );
}

/** Overlap of what two sentences assert, 0-1. */
export function claimSimilarity(a: string, b: string): number {
  const wa = contentWords(a);
  const wb = contentWords(b);
  if (wa.size < 3 || wb.size < 3) return 0;
  let shared = 0;
  for (const w of Array.from(wa)) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size);
}

/** Two sentences this similar, in DIFFERENT sections, are the same point made
 *  twice. Set high so genuine elaboration isn't flagged as repetition. */
export const REPEAT_SIMILARITY = 0.7;

/** Phrases that carry the treatment-status disclaimer. The review specifically
 *  called out repeating this across summary / research / trial / caregiver. */
const DISCLAIMER_PATTERNS = [
  /no (gene-specific )?(approved )?treatment/i,
  /do(es)? not currently identify (a|an)? ?(gene-specific)? ?(approved)? ?treatment/i,
  /no (approved )?therapy (is )?available/i,
  /not a substitute for (medical|professional)/i,
  /talk (with|to) (a )?(clinician|retinal specialist|genetic counselor)/i,
];

export function countDisclaimerSections(sections: SectionText[]): string[] {
  return sections
    .filter((s) => DISCLAIMER_PATTERNS.some((re) => re.test(s.text)))
    .map((s) => s.section);
}

export type QualityReport = {
  wordCount: number;
  sentenceCount: number;
  denseSentenceCount: number;
  warnings: QualityWarning[];
};

/**
 * Inspect a draft's main prose. Returns warnings only — the caller decides what
 * to do, and the answer is always "show a reviewer", never "truncate".
 */
export function checkGenePageQuality(sections: SectionText[]): QualityReport {
  const warnings: QualityWarning[] = [];
  const present = new Set(sections.filter((s) => s.text.trim()).map((s) => s.section));

  for (const required of REQUIRED_SECTIONS) {
    if (!present.has(required)) {
      warnings.push({
        code: "missing_section",
        message: `Required section "${required}" is missing or empty.`,
        sections: [required],
      });
    }
  }

  const main = sections.filter((s) =>
    (MAIN_PROSE_SECTIONS as readonly string[]).includes(s.section)
  );
  const total = main.reduce((n, s) => n + wordCount(s.text), 0);

  if (total < WORD_TARGET_MIN - WORD_TOLERANCE) {
    warnings.push({
      code: "word_count_low",
      message: `Main prose is ${total} words, below the ${WORD_TARGET_MIN}-${WORD_TARGET_MAX} target. Check nothing important was left out.`,
    });
  } else if (total > WORD_TARGET_MAX + WORD_TOLERANCE) {
    warnings.push({
      code: "word_count_high",
      message: `Main prose is ${total} words, above the ${WORD_TARGET_MIN}-${WORD_TARGET_MAX} target. Look for repetition before cutting anything substantive.`,
    });
  }

  // Cross-section repetition: the same claim restated elsewhere.
  const sentencesBySection = main.map((s) => ({
    section: s.section,
    sentences: splitSentences(s.text),
  }));
  const seenPairs = new Set<string>();
  for (let i = 0; i < sentencesBySection.length; i++) {
    for (let j = i + 1; j < sentencesBySection.length; j++) {
      for (const a of sentencesBySection[i].sentences) {
        for (const b of sentencesBySection[j].sentences) {
          if (claimSimilarity(a, b) < REPEAT_SIMILARITY) continue;
          const key = `${sentencesBySection[i].section}|${sentencesBySection[j].section}`;
          if (seenPairs.has(key)) continue;
          seenPairs.add(key);
          warnings.push({
            code: "repeated_claim",
            message: `"${sentencesBySection[i].section}" and "${sentencesBySection[j].section}" make the same point. State it once, in the summary or uncertainty section.`,
            sections: [sentencesBySection[i].section, sentencesBySection[j].section],
          });
        }
      }
    }
  }

  const disclaimerSections = countDisclaimerSections(main);
  if (disclaimerSections.length > 2) {
    warnings.push({
      code: "repeated_disclaimer",
      message: `The treatment-status or "talk to a clinician" disclaimer appears in ${disclaimerSections.length} sections (${disclaimerSections.join(", ")}). Keep it in at most two.`,
      sections: disclaimerSections,
    });
  }

  const allSentences = sentencesBySection.flatMap((s) => s.sentences);
  const dense = allSentences.filter((s) => wordCount(s) >= DENSE_SENTENCE_WORDS);
  if (allSentences.length && dense.length / allSentences.length > DENSE_SENTENCE_RATIO) {
    warnings.push({
      code: "dense_sentences",
      message: `${dense.length} of ${allSentences.length} sentences are ${DENSE_SENTENCE_WORDS}+ words. Split them so each carries one main idea.`,
    });
  }

  return {
    wordCount: total,
    sentenceCount: allSentences.length,
    denseSentenceCount: dense.length,
    warnings,
  };
}

// ---- Adapter for a generated draft -----------------------------------------

/** Minimal shape needed from a draft: each narrative section's sentences. */
type DraftLike = Record<string, unknown>;

function sectionText(value: unknown): string {
  const v = value as { sentences?: { text?: string }[]; text?: string } | undefined;
  if (v && Array.isArray(v.sentences)) {
    return v.sentences.map((s) => s?.text ?? "").join(" ").trim();
  }
  // Older drafts stored a section as a single { text, sourceIds } object.
  if (v && typeof v.text === "string") return v.text.trim();
  return "";
}

/** Run the quality checks against a generated gene-page draft. */
export function checkDraftQuality(draft: DraftLike): QualityReport {
  return checkGenePageQuality(
    MAIN_PROSE_SECTIONS.map((section) => ({
      section,
      text: sectionText(draft[section]),
    }))
  );
}
