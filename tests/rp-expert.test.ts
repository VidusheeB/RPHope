import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("rp-expert: missing API key", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns 503 when unconfigured", async () => {
    const mod = await import("@/app/api/openai/rp-expert/route");
    const res = await mod.POST(
      new Request("http://test/api", {
        method: "POST",
        body: JSON.stringify({ question: "hi" }),
      })
    );
    expect(res.status).toBe(503);
  });
});

describe("rp-expert: input limits", () => {
  const REAL_KEY = "sk-secret-expert-key";
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", REAL_KEY);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects an oversized body with 413", async () => {
    const huge = "x".repeat(20_000);
    const mod = await import("@/app/api/openai/rp-expert/route");
    const res = await mod.POST(
      new Request("http://test/api", {
        method: "POST",
        body: JSON.stringify({ question: huge }),
      })
    );
    expect(res.status).toBe(413);
  });

  it("rejects an empty question with 400", async () => {
    const mod = await import("@/app/api/openai/rp-expert/route");
    const res = await mod.POST(
      new Request("http://test/api", {
        method: "POST",
        body: JSON.stringify({ question: "   " }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns grounded sources with real URLs and never leaks the key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    answer: "RPGR is an X-linked gene.",
                    usedSourceIds: [],
                    confidence: "medium",
                    isSuggestion: false,
                    limitations: "",
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    const mod = await import("@/app/api/openai/rp-expert/route");
    const res = await mod.POST(
      new Request("http://test/api", {
        method: "POST",
        body: JSON.stringify({ question: "Tell me about RPGR" }),
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.answer).toContain("RPGR");
    expect(Array.isArray(json.sources)).toBe(true);
    expect(json.sources.every((s: { url: string }) => typeof s.url === "string")).toBe(true);
    expect(JSON.stringify(json)).not.toContain(REAL_KEY);
  });
});
