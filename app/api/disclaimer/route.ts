import { NextResponse } from "next/server";

// Records that a visitor acknowledged the "Before You Continue" gate.
//
// Why a server-set cookie in addition to localStorage: Safari's tracking
// prevention caps *script-writable* storage (localStorage, and cookies written
// via document.cookie) at roughly 7 days of inactivity, so the gate reappears
// for Safari/iOS visitors about once a week. A cookie set server-side via
// Set-Cookie is not subject to that cap and survives for the full year.
//
// Deliberately NOT httpOnly: the gate is a client component and reads this on
// mount. Keeping the check client-side matters — reading cookies() in the root
// layout would opt the entire site out of static rendering.

export const runtime = "nodejs";

const COOKIE = "rphope_disclaimer_ack";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: COOKIE,
    value: "1",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
