import { describe, it, expect } from "vitest";
import { getSearchTerms } from "@/lib/geneResearch/aliases";

describe("getSearchTerms", () => {
  it("always includes the official symbol first", () => {
    const { allTerms } = getSearchTerms({ symbol: "RPGR", aliases: [] });
    expect(allTerms[0]).toBe("RPGR");
  });

  it("appends the official full name when present", () => {
    const { allTerms } = getSearchTerms({
      symbol: "RPGR",
      officialFullName: "retinitis pigmentosa GTPase regulator",
      aliases: [],
    });
    expect(allTerms).toContain("retinitis pigmentosa GTPase regulator");
  });

  it("keeps specific aliases as safe", () => {
    const { safeAliases } = getSearchTerms({
      symbol: "RPGR",
      aliases: ["RP3", "CORDX1", "XLRP3"],
    });
    expect(safeAliases).toEqual(["RP3", "CORDX1", "XLRP3"]);
  });

  it("excludes generic English-word aliases (severe ambiguity risk)", () => {
    const { safeAliases, excludedAliases } = getSearchTerms({
      symbol: "GENEX",
      aliases: ["CAT", "SET", "REST"],
    });
    expect(safeAliases).toHaveLength(0);
    expect(excludedAliases).toEqual(["CAT", "SET", "REST"]);
  });

  it("excludes aliases shorter than 3 characters and purely-numeric ones", () => {
    const { safeAliases, excludedAliases } = getSearchTerms({
      symbol: "GENEX",
      aliases: ["AB", "12", "1234", "ABCD"],
    });
    expect(safeAliases).toEqual(["ABCD"]);
    expect(excludedAliases).toEqual(expect.arrayContaining(["AB", "12", "1234"]));
  });

  it("drops an alias identical to the symbol (no redundant term)", () => {
    const { allTerms } = getSearchTerms({ symbol: "RPGR", aliases: ["RPGR", "RP3"] });
    expect(allTerms.filter((t) => t === "RPGR")).toHaveLength(1);
  });

  it("deduplicates terms while preserving order", () => {
    const { allTerms } = getSearchTerms({
      symbol: "RPGR",
      officialFullName: "RP3",
      aliases: ["RP3"],
    });
    expect(allTerms).toEqual(["RPGR", "RP3"]);
  });
});
