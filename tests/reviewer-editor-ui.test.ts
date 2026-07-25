import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(process.cwd(), "components/review/ReviewEditor.tsx"), "utf8");

describe("gene review workspace — per-sentence verification control removed (static)", () => {
  it("has no <select> dropdown or verification-status checkbox left in the sentence UI", () => {
    expect(src).not.toMatch(/<select/);
    expect(src).not.toMatch(/SentenceVerificationStatus/);
    expect(src).not.toMatch(/saveSentenceReviewAction/);
  });

  it("citation numbers render inline inside the sentence, not as a separate badge row", () => {
    // SentenceRow renders [entry.number] directly after the sentence text,
    // not in a detached div below a textarea.
    expect(src).toMatch(/\[\{entry\.number\}\]/);
  });

  it("has no Request Changes UI section", () => {
    expect(src).not.toMatch(/Request changes/);
    expect(src).not.toMatch(/requestChangesAction/);
  });
});

describe("source cards — the whole card is a link, not just an 'Open source' button (static)", () => {
  it("renders each source as an <a> wrapping the whole card body", () => {
    expect(src).toMatch(/<a\s*$|<a\n|<a\s+key=\{source\.id\}/m);
    expect(src).toMatch(/href=\{source\.url\}/);
  });
});
