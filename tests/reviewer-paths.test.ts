import { describe, it, expect, vi, beforeEach } from "vitest";

// NEXT_PUBLIC_REVIEW_APP_MODE is read at module-load time, so each mode is
// tested in its own dynamic import with the env var set first.

describe("reviewHref / publicHref — off (rp-hope.vercel.app, /review/* prefix kept)", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_REVIEW_APP_MODE;
  });

  it("prefixes every path with /review", async () => {
    const { reviewHref } = await import("@/lib/reviewer/paths");
    expect(reviewHref("")).toBe("/review");
    expect(reviewHref("/admin")).toBe("/review/admin");
    expect(reviewHref("/abc123")).toBe("/review/abc123");
  });

  it("publicHref is a no-op relative link", async () => {
    const { publicHref } = await import("@/lib/reviewer/paths");
    expect(publicHref("/genetic-insights")).toBe("/genetic-insights");
    expect(publicHref("/")).toBe("/");
  });
});

describe("reviewHref / publicHref — on (rphopereview.vercel.app, bare paths)", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_REVIEW_APP_MODE = "1";
  });

  it("strips the /review prefix entirely", async () => {
    const { reviewHref } = await import("@/lib/reviewer/paths");
    expect(reviewHref("")).toBe("/");
    expect(reviewHref("/admin")).toBe("/admin");
    expect(reviewHref("/abc123")).toBe("/abc123");
  });

  it("publicHref leaves the domain entirely, pointing at the real public site", async () => {
    const { publicHref } = await import("@/lib/reviewer/paths");
    expect(publicHref("/genetic-insights")).toBe("https://rp-hope.vercel.app/genetic-insights");
    expect(publicHref("/")).toBe("https://rp-hope.vercel.app/");
  });
});
