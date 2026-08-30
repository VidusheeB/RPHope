// Prose-quality warnings for generated gene pages. These FLAG for review; they
// must never be used to delete content automatically.

import { describe, it, expect } from "vitest";
import {
  checkGenePageQuality,
  checkDraftQuality,
  claimSimilarity,
  splitSentences,
  wordCount,
  MAIN_PROSE_SECTIONS,
  WORD_TARGET_MIN,
  WORD_TARGET_MAX,
} from "@/lib/geneResearch/quality";

/** A run of DISTINCT words as one sentence. Used where density is the point. */
const filler = (n: number, seed = "w") => {
  const ws = Array.from({ length: n }, (_, i) => `${seed}${i}`);
  ws[0] = ws[0].charAt(0).toUpperCase() + ws[0].slice(1);
  return ws.join(" ") + ".";
};

/** Realistic prose: unique vocabulary per section, sentences of ~16 words, so
 *  the fixture itself is neither repetitive nor dense. Earlier fixtures reused
 *  one 110-word sentence everywhere, which the checker correctly flagged. */
function prose(words: number, seed: string): string {
  const out: string[] = [];
  let used = 0;
  let i = 0;
  while (used < words) {
    const len = Math.min(16, words - used);
    const ws = Array.from({ length: len }, () => `${seed}${i++}`);
    // Capitalise the opening word: splitSentences looks for a capital after
    // the full stop, exactly as real prose provides.
    ws[0] = ws[0].charAt(0).toUpperCase() + ws[0].slice(1);
    out.push(ws.join(" ") + ".");
    used += len;
  }
  return out.join(" ");
}

function sections(overrides: Record<string, string> = {}, perSection = 110) {
  return MAIN_PROSE_SECTIONS.map((s, idx) => ({
    section: s,
    text: overrides[s] ?? prose(perSection, `s${idx}x`),
  }));
}

describe("word-count target", () => {
  it("accepts a page inside the 900-1,100 word target", () => {
    const report = checkGenePageQuality(sections({}, 110)); // 9 x 110 = 990
    expect(report.wordCount).toBeGreaterThanOrEqual(WORD_TARGET_MIN);
    expect(report.wordCount).toBeLessThanOrEqual(WORD_TARGET_MAX);
    expect(report.warnings.map((w) => w.code)).not.toContain("word_count_high");
    expect(report.warnings.map((w) => w.code)).not.toContain("word_count_low");
  });

  it("flags an overloaded page like the 1,860-word CLRN1 draft", () => {
    const report = checkGenePageQuality(sections({}, 210)); // ~1,890
    expect(report.warnings.map((w) => w.code)).toContain("word_count_high");
  });

  it("flags a page that is suspiciously thin", () => {
    const report = checkGenePageQuality(sections({}, 20));
    expect(report.warnings.map((w) => w.code)).toContain("word_count_low");
  });

  it("warns rather than truncating — content is never modified", () => {
    const input = sections({}, 210);
    const before = input.map((s) => s.text);
    checkGenePageQuality(input);
    expect(input.map((s) => s.text)).toEqual(before);
  });

  it("tolerates a page slightly over target without nagging", () => {
    const report = checkGenePageQuality(sections({}, 130)); // ~1,170
    expect(report.warnings.map((w) => w.code)).not.toContain("word_count_high");
  });
});

describe("repetition across sections", () => {
  const CLAIM =
    "The link between this gene and retinitis pigmentosa is disputed and later evidence did not support the original association.";

  it("flags the same point restated in another section (the FSCN2 problem)", () => {
    const report = checkGenePageQuality(
      sections({ summaryCard: CLAIM, whatIsUncertain: CLAIM, whatIsKnown: CLAIM })
    );
    expect(report.warnings.map((w) => w.code)).toContain("repeated_claim");
  });

  it("does not flag two genuinely different statements", () => {
    const report = checkGenePageQuality(
      sections({
        summaryCard: "This gene helps photoreceptor cells build their light-sensing structures.",
        whatIsUncertain: "How quickly vision changes progress varies widely between people.",
      })
    );
    expect(report.warnings.map((w) => w.code)).not.toContain("repeated_claim");
  });

  it("scores near-identical claims high and unrelated ones low", () => {
    expect(claimSimilarity(CLAIM, CLAIM)).toBeGreaterThan(0.9);
    expect(
      claimSimilarity(CLAIM, "Researchers studied kidney function in twelve children.")
    ).toBeLessThan(0.3);
  });
});

describe("the treatment disclaimer is not repeated everywhere", () => {
  const D = "As of this review, no approved treatment targeting this gene is available.";

  it("flags the disclaimer appearing in four sections", () => {
    const report = checkGenePageQuality(
      sections({
        summaryCard: D,
        treatmentAndResearch: D,
        clinicalTrialSummary: D,
        forFamilyAndCaregivers: D,
      })
    );
    expect(report.warnings.map((w) => w.code)).toContain("repeated_disclaimer");
  });

  it("allows it in one or two sections", () => {
    const report = checkGenePageQuality(
      sections({ summaryCard: D, treatmentAndResearch: D })
    );
    expect(report.warnings.map((w) => w.code)).not.toContain("repeated_disclaimer");
  });
});

describe("sentence density", () => {
  it("flags prose that welds several ideas into single long sentences", () => {
    const dense = `${filler(60, "d")} ${filler(60, "e")} ${filler(60, "f")}`;
    const report = checkGenePageQuality(
      sections({
        whatIsKnown: dense,
        whatIsUncertain: `${filler(60, "g")} ${filler(60, "h")} ${filler(60, "i")}`,
        treatmentAndResearch: `${filler(60, "j")} ${filler(60, "k")} ${filler(60, "l")}`,
        howItMayAffectVision: `${filler(60, "m")} ${filler(60, "n")} ${filler(60, "o")}`,
      })
    );
    expect(report.warnings.map((w) => w.code)).toContain("dense_sentences");
  });

  it("does not flag normal prose", () => {
    const normal = prose(150, "n");
    const report = checkGenePageQuality(sections({ whatIsKnown: normal }));
    expect(report.warnings.map((w) => w.code)).not.toContain("dense_sentences");
  });

  it("splits sentences on real boundaries", () => {
    expect(splitSentences("One idea here. Another idea follows. A third.")).toHaveLength(3);
  });
});

describe("required sections", () => {
  it("flags a missing section rather than silently accepting it", () => {
    const report = checkGenePageQuality(sections({ whatIsUncertain: "" }));
    const missing = report.warnings.filter((w) => w.code === "missing_section");
    expect(missing).toHaveLength(1);
    expect(missing[0].sections).toEqual(["whatIsUncertain"]);
  });
});

describe("reads a real draft shape", () => {
  it("handles the current { sentences: [...] } sections", () => {
    const draft = Object.fromEntries(
      MAIN_PROSE_SECTIONS.map((s, i) => [s, { sentences: [{ text: prose(110, `a${i}y`), sourceIds: [] }] }])
    );
    expect(checkDraftQuality(draft).wordCount).toBeGreaterThan(900);
  });

  it("also handles the legacy { text, sourceIds } sections (LCA5's drift)", () => {
    const draft = Object.fromEntries(
      MAIN_PROSE_SECTIONS.map((s, i) => [s, { text: prose(110, `b${i}z`), sourceIds: [] }])
    );
    expect(checkDraftQuality(draft).wordCount).toBeGreaterThan(900);
  });

  it("counts words consistently", () => {
    expect(wordCount("  one two   three ")).toBe(3);
  });
});
