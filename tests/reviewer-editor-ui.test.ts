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

});

describe("Request changes lives on the publication screen, not the editor (static)", () => {
  it("is offered where an admin judges someone else's submission", () => {
    // Sending work back is a decision about ANOTHER person's review, so it
    // belongs beside that review's summary and the rendered preview — not in
    // the editor, where it was reachable while editing your own work.
    const screen = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(), "components/review/genes/PublicationReview.tsx"),
      "utf8"
    );
    expect(screen).toMatch(/requestChangesFromScreenAction/);
    // ...and never for your own review: you cannot send work back to yourself.
    expect(screen).toMatch(/!isOwnReview && canRequestChanges/);
  });

  it("the editor no longer carries a request-changes flow", () => {
    expect(src).not.toMatch(/requestChangesAction/);
    expect(src).not.toMatch(/requestChangesOpen/);
  });
});

describe("source cards — the whole card is a link, not just an 'Open source' button (static)", () => {
  it("renders each source as an <a> wrapping the whole card body", () => {
    expect(src).toMatch(/<a\s*$|<a\n|<a\s+key=\{source\.id\}/m);
    expect(src).toMatch(/href=\{source\.url\}/);
  });
});
