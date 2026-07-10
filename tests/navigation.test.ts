import { describe, it, expect } from "vitest";
import {
  resolveDestination,
  isAllowedHref,
  ALLOWED_HREFS,
} from "@/lib/voice/navigationRegistry";

describe("route allowlisting", () => {
  it("core sections are allowlisted", () => {
    for (const href of ["/", "/genetic-insights", "/clinical-trials", "/donate"]) {
      expect(isAllowedHref(href)).toBe(true);
    }
  });

  it("rejects unknown internal routes", () => {
    expect(isAllowedHref("/secret-admin")).toBe(false);
    expect(isAllowedHref("/genetic-insights/not-a-real-gene")).toBe(false);
  });

  it("has a non-trivial allowlist", () => {
    expect(ALLOWED_HREFS.size).toBeGreaterThan(20);
  });
});

describe("destination resolution", () => {
  it("resolves natural names", () => {
    expect(resolveDestination("take me home")?.href).toBe("/");
    expect(resolveDestination("the gene library")?.href).toBe("/genetic-insights");
    expect(resolveDestination("donate")?.href).toBe("/donate");
    expect(resolveDestination("clinical trials")?.href).toBe("/clinical-trials");
  });

  it("resolves a gene symbol to its page", () => {
    expect(resolveDestination("RPGR")?.href).toBe("/genetic-insights/rpgr");
    expect(resolveDestination("go to USH2A")?.href).toBe("/genetic-insights/ush2a");
  });

  it("rejects external URLs", () => {
    expect(resolveDestination("https://evil.example.com")).toBeNull();
    expect(resolveDestination("http://openai.com")).toBeNull();
  });

  it("rejects gibberish / unknown destinations", () => {
    expect(resolveDestination("the moon base")).toBeNull();
    expect(resolveDestination("")).toBeNull();
  });

  it("only ever returns allowlisted hrefs", () => {
    for (const name of ["home", "genes", "RPGR", "donate", "stories", "events"]) {
      const dest = resolveDestination(name);
      if (dest) expect(isAllowedHref(dest.href)).toBe(true);
    }
  });
});
