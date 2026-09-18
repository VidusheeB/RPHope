import { describe, it, expect } from "vitest";
import { routePortalRequest } from "@/lib/reviewer/portalBoundary";

const PUBLIC = false;
const PORTAL = true;

describe("public deployment (rp-hope.org) — the portal does not exist here", () => {
  it("404s the portal root and every portal page", () => {
    // Not "protected" — absent. An internal tool should not have a door on
    // the public domain even a locked one.
    for (const p of ["/review", "/review/", "/review/genes", "/review/admin", "/review/login", "/review/stories/abc"]) {
      expect(routePortalRequest(p, PUBLIC)).toEqual({ kind: "not-found" });
    }
  });

  it("404s portal-only API routes, so the boundary can't be stepped around", () => {
    expect(routePortalRequest("/api/genes/generation/status", PUBLIC)).toEqual({ kind: "not-found" });
    expect(routePortalRequest("/api/genes/generation/drain", PUBLIC)).toEqual({ kind: "not-found" });
  });

  it("leaves the public website completely alone", () => {
    for (const p of ["/", "/genetic-insights", "/genetic-insights/rpgr", "/stories", "/donate", "/events", "/clinical-trials"]) {
      expect(routePortalRequest(p, PUBLIC)).toEqual({ kind: "pass" });
    }
  });

  it("leaves PUBLIC api routes working — they belong to the website", () => {
    // Regression guard: over-broad blocking here would silently break
    // read-aloud, the trials finder, the voice assistant and story submission.
    for (const p of ["/api/tts", "/api/trials/match", "/api/stories/submit", "/api/openai/realtime-token", "/api/navigate"]) {
      expect(routePortalRequest(p, PUBLIC)).toEqual({ kind: "pass" });
    }
  });

  it("does not block a public route that merely starts with the same letters", () => {
    expect(routePortalRequest("/reviews", PUBLIC)).toEqual({ kind: "pass" });
    expect(routePortalRequest("/review-board", PUBLIC)).toEqual({ kind: "pass" });
  });
});

describe("portal deployment (rphopereview.vercel.app) — bare paths", () => {
  it("serves the portal at the root", () => {
    expect(routePortalRequest("/", PORTAL)).toEqual({ kind: "rewrite", pathname: "/review" });
  });

  it("rewrites bare portal paths to their real routes", () => {
    expect(routePortalRequest("/genes", PORTAL)).toEqual({ kind: "rewrite", pathname: "/review/genes" });
    expect(routePortalRequest("/tickets", PORTAL)).toEqual({ kind: "rewrite", pathname: "/review/tickets" });
    expect(routePortalRequest("/login", PORTAL)).toEqual({ kind: "rewrite", pathname: "/review/login" });
    expect(routePortalRequest("/admin/genes/abc", PORTAL)).toEqual({
      kind: "rewrite",
      pathname: "/review/admin/genes/abc",
    });
  });

  it("passes already-canonical /review paths through without a rewrite loop", () => {
    expect(routePortalRequest("/review", PORTAL)).toEqual({ kind: "pass" });
    expect(routePortalRequest("/review/genes", PORTAL)).toEqual({ kind: "pass" });
  });

  it("never rewrites API routes — the client fetches /api/... literally", () => {
    // A rewrite here would send /api/genes/generation/status to
    // /review/api/... and silently break generation polling on the portal.
    expect(routePortalRequest("/api/genes/generation/status", PORTAL)).toEqual({ kind: "pass" });
    expect(routePortalRequest("/api/tts", PORTAL)).toEqual({ kind: "pass" });
  });
});
