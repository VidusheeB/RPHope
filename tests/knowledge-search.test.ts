import { describe, it, expect } from "vitest";
import { searchKnowledge } from "@/lib/knowledge/search";
import { expandQuery } from "@/lib/knowledge/synonyms";

describe("knowledge search ranking", () => {
  it("returns results for a plain topical query", () => {
    const results = searchKnowledge("clinical trials");
    expect(results.length).toBeGreaterThan(0);
    // A trials-related result should rank near the top.
    expect(
      results.slice(0, 3).some((r) => /trial/i.test(r.title + r.snippet + r.url))
    ).toBe(true);
  });

  it("boosts a record on the current page", () => {
    const withPage = searchKnowledge("genes", { currentUrl: "/genetic-insights", limit: 5 });
    expect(withPage[0]?.url).toBe("/genetic-insights");
  });

  it("returns empty for whitespace", () => {
    expect(searchKnowledge("   ")).toEqual([]);
  });
});

describe("exact gene-symbol search", () => {
  it("promotes the exact gene page for a symbol query", () => {
    const results = searchKnowledge("tell me about RPGR");
    expect(results[0]?.url).toBe("/genetic-insights/rpgr");
    expect(results[0]?.contentType).toBe("gene");
  });

  it("matches USH2A", () => {
    const results = searchKnowledge("USH2A");
    expect(results[0]?.url).toBe("/genetic-insights/ush2a");
  });
});

describe("synonym expansion", () => {
  it("expands RP to retinitis pigmentosa", () => {
    expect(expandQuery("what is RP").toLowerCase()).toContain("retinitis");
  });

  it("maps study/trial vocabulary", () => {
    expect(expandQuery("any studies I can join").toLowerCase()).toContain("clinical trial");
  });

  it("is purely additive (keeps original words)", () => {
    const out = expandQuery("genetic test");
    expect(out).toContain("genetic test");
    expect(out.toLowerCase()).toContain("genetic testing");
  });

  it("finds genetic testing info via a synonym", () => {
    const results = searchKnowledge("gene test");
    expect(results.some((r) => r.url === "/newly-diagnosed")).toBe(true);
  });
});
