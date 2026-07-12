import { describe, it, expect } from "vitest";
import { isApprovedDomain, APPROVED_WEB_DOMAINS } from "@/lib/geneResearch/webSearchAllowlist";
import { isEvidenceThin, THIN_EVIDENCE_THRESHOLD } from "@/lib/geneResearch/webSearchFallback";

describe("isApprovedDomain", () => {
  it("approves exact matches from the allowlist", () => {
    expect(isApprovedDomain("https://clinicaltrials.gov/study/NCT123")).toBe(true);
    expect(isApprovedDomain("https://www.fda.gov/news/x")).toBe(true); // www. stripped
  });

  it("approves subdomains of allowlisted domains", () => {
    expect(isApprovedDomain("https://pubmed.ncbi.nlm.nih.gov/12345/")).toBe(true);
  });

  it("rejects domains not on the allowlist", () => {
    expect(isApprovedDomain("https://random-blog.example.com/post")).toBe(false);
    expect(isApprovedDomain("https://reddit.com/r/retinitis")).toBe(false);
  });

  it("rejects a lookalike domain (not a real subdomain)", () => {
    // "fda.gov.evil.com" is NOT a subdomain of fda.gov — must not match.
    expect(isApprovedDomain("https://fda.gov.evil.com/x")).toBe(false);
  });

  it("handles malformed URLs safely (no throw)", () => {
    expect(isApprovedDomain("not-a-url")).toBe(false);
  });

  it("the allowlist itself is non-empty and includes ClinicalTrials.gov", () => {
    expect(APPROVED_WEB_DOMAINS.length).toBeGreaterThan(5);
    expect(APPROVED_WEB_DOMAINS).toContain("clinicaltrials.gov");
  });
});

describe("isEvidenceThin", () => {
  it("is thin when combined evidence is below the threshold", () => {
    expect(isEvidenceThin(0, 0)).toBe(true);
    expect(isEvidenceThin(1, 0)).toBe(true);
  });

  it("is not thin once combined evidence meets the threshold", () => {
    expect(isEvidenceThin(THIN_EVIDENCE_THRESHOLD, 0)).toBe(false);
    expect(isEvidenceThin(2, 5)).toBe(false);
  });
});
