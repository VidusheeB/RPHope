import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

// Regression guard for a bug that shipped: every invitation email pointed at
// http://localhost:3000/set-password, because the redirect was built from
// NEXT_PUBLIC_SITE_URL. Recipients got a link that refused to connect, and it
// read as a broken product rather than a misconfiguration.
describe("emailed links point at the deployment that sent them", () => {
  const actions = read("app/review/actions.ts");

  it("invitations derive their redirect from the request, not an env var", () => {
    expect(actions).toMatch(/const origin = portalOrigin\(\);/);
    expect(actions).not.toMatch(/process\.env\.NEXT_PUBLIC_SITE_URL[^\n]*set-password/);
  });

  it("both invite AND resend are fixed", () => {
    // The resend path had its own copy of the same line; fixing only the first
    // would leave "Resend invitation" still mailing a dead link.
    const occurrences = actions.match(/const origin = portalOrigin\(\);/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("refuses to send rather than emailing an unusable link", () => {
    expect(actions).toMatch(/no invitation was sent/);
  });
});

describe("portalOrigin", () => {
  const src = read("lib/portalOrigin.ts");

  it("prefers the forwarded host a proxy reports", () => {
    // `host` alone can be an internal address behind a CDN.
    expect(src).toMatch(/x-forwarded-host/);
    expect(src).toMatch(/x-forwarded-proto/);
  });

  it("does not guess https for localhost", () => {
    // An https://localhost link refuses to connect, which would recreate the
    // same "broken link" symptom in development.
    expect(src).toMatch(/startsWith\("localhost"\)/);
    expect(src).toMatch(/"http"/);
  });
});
