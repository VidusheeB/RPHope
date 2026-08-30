// Capacity behaviour for concurrent use of the voice assistant.

import { describe, it, expect } from "vitest";
import {
  IDLE_TIMEOUT_MS,
  IDLE_WARNING_MS,
  GLOBAL_SESSION_STARTS_PER_MIN,
  isIdleExpired,
  msUntilIdleTimeout,
  isCapacityError,
} from "@/lib/voice/capacity";
import { rateLimit } from "@/lib/voice/rateLimit";

describe("an abandoned session releases its capacity", () => {
  const t0 = 1_000_000;

  it("is not expired while someone is still talking", () => {
    expect(isIdleExpired(t0, t0 + IDLE_TIMEOUT_MS - 1)).toBe(false);
  });

  it("expires once the silence passes the timeout", () => {
    expect(isIdleExpired(t0, t0 + IDLE_TIMEOUT_MS)).toBe(true);
  });

  it("frees capacity in minutes, not the 45-minute session cap", () => {
    // The whole point: one visitor who walks away must not hold an OpenAI
    // realtime slot (or an open microphone) for the full session limit.
    expect(IDLE_TIMEOUT_MS).toBeLessThanOrEqual(5 * 60 * 1000);
    expect(IDLE_TIMEOUT_MS).toBeLessThan(45 * 60 * 1000);
  });

  it("counts down and floors at zero", () => {
    expect(msUntilIdleTimeout(t0, t0)).toBe(IDLE_TIMEOUT_MS);
    expect(msUntilIdleTimeout(t0, t0 + IDLE_TIMEOUT_MS + 5000)).toBe(0);
  });

  it("leaves room to warn before cutting someone off", () => {
    expect(IDLE_WARNING_MS).toBeGreaterThan(0);
    expect(IDLE_WARNING_MS).toBeLessThan(IDLE_TIMEOUT_MS);
  });
});

describe("a burst of visitors fails politely instead of stampeding OpenAI", () => {
  it("allows a normal number of concurrent starts", () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < GLOBAL_SESSION_STARTS_PER_MIN; i++) {
      expect(rateLimit(key, { limit: GLOBAL_SESSION_STARTS_PER_MIN, windowMs: 60_000 }).ok).toBe(true);
    }
  });

  it("refuses beyond the cap, with a Retry-After the UI can show", () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < GLOBAL_SESSION_STARTS_PER_MIN; i++) {
      rateLimit(key, { limit: GLOBAL_SESSION_STARTS_PER_MIN, windowMs: 60_000 });
    }
    const blocked = rateLimit(key, { limit: GLOBAL_SESSION_STARTS_PER_MIN, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("caps starts well above one visitor's own limit but below a stampede", () => {
    // Has to exceed the 20/min per-visitor cap to not punish a single user,
    // while still bounding what the account is exposed to.
    expect(GLOBAL_SESSION_STARTS_PER_MIN).toBeGreaterThan(20);
    expect(GLOBAL_SESSION_STARTS_PER_MIN).toBeLessThanOrEqual(60);
  });
});

describe("an OpenAI 429 is reported as busy, not as a broken connection", () => {
  it("recognises the SDP-parse symptom of a rate-limited call", () => {
    // What the browser actually shows: the SDK feeds OpenAI's JSON 429 body to
    // setRemoteDescription, which fails parsing an SDP.
    expect(
      isCapacityError(
        "Failed to execute 'setRemoteDescription' on 'RTCPeerConnection': Failed to parse SessionDescription. { Expect line: v="
      )
    ).toBe(true);
  });

  it("recognises an explicit 429 or rate-limit message", () => {
    expect(isCapacityError("Request failed with status 429")).toBe(true);
    expect(isCapacityError("rate limit exceeded")).toBe(true);
  });

  it("does not mislabel a genuine network failure as busy", () => {
    expect(isCapacityError("NetworkError when attempting to fetch resource")).toBe(false);
    expect(isCapacityError("ICE connection failed")).toBe(false);
  });
});
