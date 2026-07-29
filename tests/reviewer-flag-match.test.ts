import { describe, it, expect } from "vitest";
import { findBestMatchingSentence } from "@/lib/reviewer/flagMatch";

const sections = [
  {
    sectionKey: "whatIsKnown",
    sentences: [
      { text: "RPGR mutations cause X-linked retinitis pigmentosa in most affected males." },
      { text: "Vision loss typically begins in childhood with night blindness." },
    ],
  },
  {
    sectionKey: "treatmentAndResearch",
    sentences: [
      { text: "Several gene therapy trials are investigating AAV-delivered RPGR replacement." },
    ],
  },
];

describe("findBestMatchingSentence", () => {
  it("finds the sentence with the most shared significant words", () => {
    const result = findBestMatchingSentence(
      "The claim about gene therapy trials for RPGR replacement needs a source check",
      sections
    );
    expect(result).toEqual({ sectionKey: "treatmentAndResearch", sentenceIndex: 0 });
  });

  it("matches a different section when the flag is about night blindness", () => {
    const result = findBestMatchingSentence("Confirm the night blindness onset age claim", sections);
    expect(result).toEqual({ sectionKey: "whatIsKnown", sentenceIndex: 1 });
  });

  it("returns null when nothing scores above zero", () => {
    expect(findBestMatchingSentence("xyz completely unrelated qqq", sections)).toBeNull();
  });

  it("returns null for empty/stopword-only flag text", () => {
    expect(findBestMatchingSentence("the a an of to", sections)).toBeNull();
  });
});
