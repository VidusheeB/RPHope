import { describe, it, expect } from "vitest";
import {
  resolveStatusOnEdit,
  sameSourceIds,
  verificationProgress,
  allSentencesVerified,
  requiresVerification,
} from "@/lib/reviewer/sentenceVerification";

describe("resolveStatusOnEdit — editing a verified sentence resets it", () => {
  it("editing the TEXT of a verified sentence resets it to unreviewed", () => {
    expect(
      resolveStatusOnEdit({
        currentStatus: "verified_as_written",
        textChanged: true,
        sourceIdsChanged: false,
      })
    ).toBe("unreviewed");
  });

  it("editing the CITATIONS of a verified sentence resets it to unreviewed", () => {
    expect(
      resolveStatusOnEdit({
        currentStatus: "edited_and_verified",
        textChanged: false,
        sourceIdsChanged: true,
      })
    ).toBe("unreviewed");
  });

  it("no change leaves a verified sentence's status untouched", () => {
    expect(
      resolveStatusOnEdit({
        currentStatus: "verified_as_written",
        textChanged: false,
        sourceIdsChanged: false,
      })
    ).toBe("verified_as_written");
  });

  it("editing an already-unreviewed sentence stays unreviewed (nothing to reset)", () => {
    expect(
      resolveStatusOnEdit({ currentStatus: "unreviewed", textChanged: true, sourceIdsChanged: false })
    ).toBe("unreviewed");
  });

  it("editing a 'removed' or 'not_applicable' sentence does NOT reset it — those are deliberate reviewer decisions, not stale verifications", () => {
    expect(
      resolveStatusOnEdit({ currentStatus: "removed", textChanged: true, sourceIdsChanged: false })
    ).toBe("removed");
    expect(
      resolveStatusOnEdit({ currentStatus: "not_applicable", textChanged: true, sourceIdsChanged: false })
    ).toBe("not_applicable");
  });
});

describe("sameSourceIds", () => {
  it("true for the same set regardless of order", () => {
    expect(sameSourceIds(["a", "b"], ["b", "a"])).toBe(true);
  });
  it("false for a different set", () => {
    expect(sameSourceIds(["a", "b"], ["a"])).toBe(false);
    expect(sameSourceIds(["a"], ["b"])).toBe(false);
  });
});

describe("requiresVerification", () => {
  it("a sentence with citations requires verification", () => {
    expect(requiresVerification(["pubmed:1"])).toBe(true);
  });
  it("a sentence with no citations (a transition sentence) does not", () => {
    expect(requiresVerification([])).toBe(false);
  });
});

describe("verificationProgress / allSentencesVerified", () => {
  it("only counts citation-bearing sentences toward the total", () => {
    const rows = [
      { sourceIds: ["pubmed:1"], status: "verified_as_written" as const },
      { sourceIds: [], status: "unreviewed" as const }, // transition sentence — excluded
      { sourceIds: ["pubmed:2"], status: "unreviewed" as const },
    ];
    expect(verificationProgress(rows)).toEqual({ total: 2, verified: 1 });
    expect(allSentencesVerified(rows)).toBe(false);
  });

  it("true once every citation-bearing sentence has a non-unreviewed outcome", () => {
    const rows = [
      { sourceIds: ["pubmed:1"], status: "verified_as_written" as const },
      { sourceIds: ["pubmed:2"], status: "not_applicable" as const },
    ];
    expect(allSentencesVerified(rows)).toBe(true);
  });

  it("true vacuously when there's nothing to verify", () => {
    expect(allSentencesVerified([])).toBe(true);
  });
});
