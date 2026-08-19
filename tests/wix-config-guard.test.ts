import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// lib/wix/client reads the env at module load, so each block resets modules and
// stubs the environment before importing.

describe("Wix integration degrades gracefully with no credentials", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("WIX_API_KEY", "");
    vi.stubEnv("WIX_SITE_ID", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("reports itself as not configured and builds no client", async () => {
    const { wixConfigured, wixClient } = await import("@/lib/wix/client");
    expect(wixConfigured).toBe(false);
    expect(wixClient).toBeNull();
  });

  it("lists no events and flags the list as unavailable instead of throwing", async () => {
    const { listUpcomingEvents } = await import("@/lib/wix/events");
    await expect(listUpcomingEvents()).resolves.toEqual({ events: [], unavailable: true });
  });

  it("returns null for a detail lookup instead of throwing", async () => {
    const { getEventBySlug, getEventForRegistration } = await import("@/lib/wix/events");
    await expect(getEventBySlug("anything")).resolves.toBeNull();
    await expect(getEventForRegistration("evt-1")).resolves.toBeNull();
  });

  it("refuses to register rather than reporting a false success", async () => {
    const { createRsvp } = await import("@/lib/wix/rsvp");
    const outcome = await createRsvp({
      eventId: "evt-1",
      fields: [],
      values: {},
      status: "YES",
      identity: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
    });
    expect(outcome.ok).toBe(false);
  });
});

describe("credentials are never exposed", () => {
  const SECRET = "wix-live-SUPER-SECRET-KEY-should-never-appear";

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("WIX_API_KEY", SECRET);
    vi.stubEnv("WIX_SITE_ID", "site-123");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("marks itself configured without surfacing the key", async () => {
    const mod = await import("@/lib/wix/client");
    expect(mod.wixConfigured).toBe(true);
    // The module's own public surface must not carry the raw key.
    expect(JSON.stringify(Object.keys(mod))).not.toContain(SECRET);
  });

  it("keeps the key out of a failed registration's result", async () => {
    // Fail at the network boundary so the suite never talks to real Wix.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw Object.assign(new Error("upstream refused"), {
          details: { applicationError: { code: "RSVPS_CLOSED" } },
        });
      }),
    );
    const { createRsvp } = await import("@/lib/wix/rsvp");
    const outcome = await createRsvp({
      eventId: "evt-1",
      fields: [],
      values: {},
      status: "YES",
      identity: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
    });
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome)).not.toContain(SECRET);
    vi.unstubAllGlobals();
  });
});

describe("Wix application-error extraction", () => {
  it("reads the nested application error code Wix returns", async () => {
    const { wixErrorCode } = await import("@/lib/wix/rsvp");
    expect(wixErrorCode({ details: { applicationError: { code: "RSVPS_CLOSED" } } })).toBe(
      "RSVPS_CLOSED",
    );
    expect(wixErrorCode({ applicationError: { code: "GUEST_LIMIT_EXCEEDED" } })).toBe(
      "GUEST_LIMIT_EXCEEDED",
    );
  });

  it("returns null for shapes it doesn't recognise", async () => {
    const { wixErrorCode } = await import("@/lib/wix/rsvp");
    expect(wixErrorCode(new Error("network"))).toBeNull();
    expect(wixErrorCode(null)).toBeNull();
    expect(wixErrorCode("boom")).toBeNull();
  });
});
