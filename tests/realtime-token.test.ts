import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The route reads process.env.OPENAI_API_KEY at module load, so each test resets
// modules and stubs env before importing.

describe("realtime-token: missing API key", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("GET reports not configured", async () => {
    const mod = await import("@/app/api/openai/realtime-token/route");
    const res = await mod.GET();
    expect((await res.json()).configured).toBe(false);
  });

  it("POST returns 503", async () => {
    const mod = await import("@/app/api/openai/realtime-token/route");
    const res = await mod.POST(new Request("http://test/api", { method: "POST" }));
    expect(res.status).toBe(503);
  });
});

describe("realtime-token: never leaks the real key", () => {
  const REAL_KEY = "sk-live-SUPER-SECRET-REAL-KEY-should-never-appear";

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OPENAI_API_KEY", REAL_KEY);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns only the ephemeral token, not the API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ value: "ek_ephemeral_abc123", expires_at: 999 }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    const mod = await import("@/app/api/openai/realtime-token/route");
    const res = await mod.POST(
      new Request("http://test/api", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.5" },
      })
    );
    const json = await res.json();
    expect(json.value).toBe("ek_ephemeral_abc123");
    // The serialized response must not contain the real key anywhere.
    expect(JSON.stringify(json)).not.toContain(REAL_KEY);
  });

  it("does not forward the upstream key on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Unauthorized", { status: 401 }))
    );
    const mod = await import("@/app/api/openai/realtime-token/route");
    const res = await mod.POST(new Request("http://test/api", { method: "POST" }));
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain(REAL_KEY);
  });
});
